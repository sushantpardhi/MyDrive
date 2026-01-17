#include "image_ops.h"
#include <cuda_runtime.h>
#include <device_launch_parameters.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Simple JPEG/PNG/WebP decoder using host CPU (can be optimized with nvJPEG)
// For production, use NVIDIA's nvJPEG library for GPU-accelerated decoding

// GPU Texture memory for image processing
static cudaArray_t image_array = NULL;
static cudaTextureObject_t tex_obj = 0;

// CUDA kernel: bilinear resize with proper interpolation
__global__ void kernel_resize_bilinear(const uint8_t* input, uint8_t* output, 
                                       int in_width, int in_height,
                                       int out_width, int out_height, int channels) {
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;w

    if (x >= out_width || y >= out_height) return;

    float scale_x = (float)in_width / out_width;
    float scale_y = (float)in_height / out_height;

    float src_x = x * scale_x;
    float src_y = y * scale_y;

    int x0 = (int)src_x;
    int y0 = (int)src_y;
    int x1 = min(x0 + 1, in_width - 1);
    int y1 = min(y0 + 1, in_height - 1);

    float dx = src_x - x0;
    float dy = src_y - y0;

    // Bilinear interpolation for each channel
    for (int c = 0; c < channels; c++) {
        float p00 = input[(y0 * in_width + x0) * channels + c];
        float p10 = input[(y0 * in_width + x1) * channels + c];
        float p01 = input[(y1 * in_width + x0) * channels + c];
        float p11 = input[(y1 * in_width + x1) * channels + c];

        float result = (1-dx)*(1-dy)*p00 + dx*(1-dy)*p10 + 
                       (1-dx)*dy*p01 + dx*dy*p11;

        output[(y * out_width + x) * channels + c] = (uint8_t)min(255.f, max(0.f, result));
    }
}

// CUDA kernel: Gaussian blur using shared memory
// Simple 3x3 Gaussian blur on each 3-channel pixel
__global__ void kernel_gaussian_blur(const uint8_t* input, uint8_t* output, 
                                      int width, int height, int channels) {
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;

    if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) return;

    float kernel[9] = {1/16.f, 2/16.f, 1/16.f,
                       2/16.f, 4/16.f, 2/16.f,
                       1/16.f, 2/16.f, 1/16.f};

    for (int c = 0; c < channels; c++) {
        float sum = 0;
        int k = 0;
        for (int dy = -1; dy <= 1; dy++) {
            for (int dx = -1; dx <= 1; dx++) {
                int src_idx = ((y + dy) * width + (x + dx)) * channels + c;
                sum += input[src_idx] * kernel[k++];
            }
        }
        int out_idx = (y * width + x) * channels + c;
        output[out_idx] = (uint8_t)min(255.f, max(0.f, sum));
    }
}

// CUDA kernel: downscale with nearest neighbor
__global__ void kernel_downscale_nearest(const uint8_t* input, uint8_t* output,
                                          int in_width, int in_height,
                                          int out_width, int out_height,
                                          int channels) {
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;

    if (x >= out_width || y >= out_height) return;

    int src_x = (x * in_width) / out_width;
    int src_y = (y * in_height) / out_height;

    for (int c = 0; c < channels; c++) {
        output[(y * out_width + x) * channels + c] = 
            input[(src_y * in_width + src_x) * channels + c];
    }
}

// Initialization
int cuda_init(void) {
    cudaError_t err = cudaSetDevice(0);
    if (err != cudaSuccess) {
        fprintf(stderr, "CUDA error: %s\n", cudaGetErrorString(err));
        return -1;
    }
    return 0;
}

void cuda_cleanup(void) {
    if (image_array != NULL) {
        cudaFreeArray(image_array);
        image_array = NULL;
    }
    if (tex_obj != 0) {
        cudaDestroyTextureObject(tex_obj);
        tex_obj = 0;
    }
    cudaDeviceReset();
}

void cuda_free(void* ptr) {
    cudaFree(ptr);
}

// Helper to calculate output dimensions maintaining aspect ratio
static void calculate_dimensions(int in_width, int in_height, int max_size,
                                 int* out_width, int* out_height) {
    int max_dim = (in_width > in_height) ? in_width : in_height;
    
    if (max_dim <= max_size) {
        *out_width = in_width;
        *out_height = in_height;
    } else {
        float scale = (float)max_size / max_dim;
        *out_width = (int)(in_width * scale);
        *out_height = (int)(in_height * scale);
        if (*out_width < 1) *out_width = 1;
        if (*out_height < 1) *out_height = 1;
    }
}

// Thumbnail: resize to smallest dimensions (64px)
uint8_t* cuda_process_thumbnail(const uint8_t* input, int input_width, int input_height,
                                uint32_t* output_size, int* out_width, int* out_height) {
    const int channels = 3;
    calculate_dimensions(input_width, input_height, THUMBNAIL_SIZE, out_width, out_height);

    size_t input_bytes = input_width * input_height * channels;
    size_t output_bytes = (*out_width) * (*out_height) * channels;

    uint8_t* gpu_input;
    uint8_t* gpu_output;
    cudaMalloc(&gpu_input, input_bytes);
    cudaMalloc(&gpu_output, output_bytes);
    cudaMemcpy(gpu_input, input, input_bytes, cudaMemcpyHostToDevice);

    dim3 threads(16, 16);
    dim3 blocks((*out_width + threads.x - 1) / threads.x,
                (*out_height + threads.y - 1) / threads.y);

    kernel_resize_bilinear<<<blocks, threads>>>(gpu_input, gpu_output,
                                                 input_width, input_height,
                                                 *out_width, *out_height, channels);
    cudaDeviceSynchronize();

    uint8_t* host_output = (uint8_t*)malloc(output_bytes);
    cudaMemcpy(host_output, gpu_output, output_bytes, cudaMemcpyDeviceToHost);

    cudaFree(gpu_input);
    cudaFree(gpu_output);

    *output_size = output_bytes;
    return host_output;
}

// Blur: resize to medium-small (256px) and apply Gaussian blur
uint8_t* cuda_process_blur(const uint8_t* input, int input_width, int input_height,
                           uint32_t* output_size, int* out_width, int* out_height) {
    const int channels = 3;
    calculate_dimensions(input_width, input_height, BLUR_SIZE, out_width, out_height);

    size_t input_bytes = input_width * input_height * channels;
    size_t resized_bytes = (*out_width) * (*out_height) * channels;

    uint8_t* gpu_input;
    uint8_t* gpu_resized;
    uint8_t* gpu_output;
    cudaMalloc(&gpu_input, input_bytes);
    cudaMalloc(&gpu_resized, resized_bytes);
    cudaMalloc(&gpu_output, resized_bytes);
    cudaMemcpy(gpu_input, input, input_bytes, cudaMemcpyHostToDevice);

    dim3 threads(16, 16);
    dim3 blocks((*out_width + threads.x - 1) / threads.x,
                (*out_height + threads.y - 1) / threads.y);

    // Step 1: Resize
    kernel_resize_bilinear<<<blocks, threads>>>(gpu_input, gpu_resized,
                                                 input_width, input_height,
                                                 *out_width, *out_height, channels);
    cudaDeviceSynchronize();

    // Step 2: Apply blur
    kernel_gaussian_blur<<<blocks, threads>>>(gpu_resized, gpu_output, 
                                              *out_width, *out_height, channels);
    cudaDeviceSynchronize();

    uint8_t* host_output = (uint8_t*)malloc(resized_bytes);
    cudaMemcpy(host_output, gpu_output, resized_bytes, cudaMemcpyDeviceToHost);

    cudaFree(gpu_input);
    cudaFree(gpu_resized);
    cudaFree(gpu_output);

    *output_size = resized_bytes;
    return host_output;
}

// Low-quality: resize to medium size (512px)
uint8_t* cuda_process_low_quality(const uint8_t* input, int input_width, int input_height,
                                  uint32_t* output_size, int* out_width, int* out_height) {
    const int channels = 3;
    calculate_dimensions(input_width, input_height, LOW_QUALITY_SIZE, out_width, out_height);

    size_t input_bytes = input_width * input_height * channels;
    size_t output_bytes = (*out_width) * (*out_height) * channels;

    uint8_t* gpu_input;
    uint8_t* gpu_output;
    cudaMalloc(&gpu_input, input_bytes);
    cudaMalloc(&gpu_output, output_bytes);
    cudaMemcpy(gpu_input, input, input_bytes, cudaMemcpyHostToDevice);

    dim3 threads(16, 16);
    dim3 blocks((*out_width + threads.x - 1) / threads.x,
                (*out_height + threads.y - 1) / threads.y);

    kernel_resize_bilinear<<<blocks, threads>>>(gpu_input, gpu_output,
                                                 input_width, input_height,
                                                 *out_width, *out_height, channels);
    cudaDeviceSynchronize();

    uint8_t* host_output = (uint8_t*)malloc(output_bytes);
    cudaMemcpy(host_output, gpu_output, output_bytes, cudaMemcpyDeviceToHost);

    cudaFree(gpu_input);
    cudaFree(gpu_output);

    *output_size = output_bytes;
    return host_output;
}
