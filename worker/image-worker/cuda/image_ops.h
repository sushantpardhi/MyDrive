#ifndef IMAGE_OPS_H
#define IMAGE_OPS_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

// Quality ordering: thumbnail < blur < low-quality < original
// Dimensions:
#define THUMBNAIL_SIZE 64      // Smallest: 64px max dimension
#define BLUR_SIZE 256          // Medium-small: 256px max dimension  
#define LOW_QUALITY_SIZE 512   // Medium: 512px max dimension

// Initialize CUDA runtime
// Returns: 0 on success, non-zero error code on failure
int cuda_init(void);

// Cleanup CUDA resources
void cuda_cleanup(void);

// Free GPU-allocated memory
void cuda_free(void* ptr);

// Thumbnail operation: resize to 64px (smallest)
// Returns raw RGB pixel data to be encoded as WebP with quality 30 in Go
// input: pointer to decoded RGB pixels
// input_width, input_height: input dimensions
// output_size: pointer to store output size (set by function)
// Returns: pointer to RGB pixel data (must be freed with cuda_free)
uint8_t* cuda_process_thumbnail(const uint8_t* input, int input_width, int input_height, 
                                uint32_t* output_size, int* out_width, int* out_height);

// Blur operation: resize to 256px and apply Gaussian blur
// Returns raw RGB pixel data to be encoded as WebP with quality 50 in Go
uint8_t* cuda_process_blur(const uint8_t* input, int input_width, int input_height,
                           uint32_t* output_size, int* out_width, int* out_height);

// Low-quality operation: resize to 512px
// Returns raw RGB pixel data to be encoded as WebP with quality 70 in Go
uint8_t* cuda_process_low_quality(const uint8_t* input, int input_width, int input_height,
                                  uint32_t* output_size, int* out_width, int* out_height);

#ifdef __cplusplus
}
#endif

#endif // IMAGE_OPS_H
