#ifndef IMAGE_OPS_H
#define IMAGE_OPS_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

// Initialize CUDA runtime
// Returns: 0 on success, non-zero error code on failure
int cuda_init(void);

// Cleanup CUDA resources
void cuda_cleanup(void);

// Free GPU-allocated memory
void cuda_free(void* ptr);

// Thumbnail operation: resize to 256px width, return WebP
// input: pointer to image bytes (JPEG/PNG/WebP)
// input_size: size of input buffer in bytes
// output_size: pointer to store output size (set by function)
// Returns: pointer to WebP-encoded bytes (must be freed with cuda_free)
uint8_t* cuda_process_thumbnail(const uint8_t* input, uint32_t input_size, uint32_t* output_size);

// Blur operation: apply Gaussian blur, return WebP
uint8_t* cuda_process_blur(const uint8_t* input, uint32_t input_size, uint32_t* output_size);

// Low-quality operation: downscale and recompress, return WebP
uint8_t* cuda_process_low_quality(const uint8_t* input, uint32_t input_size, uint32_t* output_size);

#ifdef __cplusplus
}
#endif

#endif // IMAGE_OPS_H
