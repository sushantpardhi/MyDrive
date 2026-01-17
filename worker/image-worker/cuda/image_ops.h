#ifndef IMAGE_OPS_H
#define IMAGE_OPS_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

// ============================================================================
// Quality Settings for Image Processing
// Size/Quality Order: thumbnail < blur < low-quality < original
// ============================================================================

// Thumbnail: Smallest output - 128px width, WebP quality 30%
#define THUMBNAIL_MAX_WIDTH     128
#define THUMBNAIL_WEBP_QUALITY  30

// Blur: Small output - 320px width, WebP quality 50%, with Gaussian blur
#define BLUR_MAX_WIDTH          320
#define BLUR_WEBP_QUALITY       50
#define BLUR_RADIUS             5

// Low-Quality: Medium output - 640px width, WebP quality 65%
#define LOW_QUALITY_MAX_WIDTH   640
#define LOW_QUALITY_WEBP_QUALITY 65

// ============================================================================
// CUDA Operations API
// ============================================================================

// Initialize CUDA runtime
// Returns: 0 on success, non-zero error code on failure
int cuda_init(void);

// Cleanup CUDA resources
void cuda_cleanup(void);

// Free GPU-allocated memory
void cuda_free(void* ptr);

// Thumbnail operation: resize to smallest size (128px), lowest quality (30%)
// Produces the smallest file size of all operations
// input: pointer to image bytes (JPEG/PNG/WebP)
// input_size: size of input buffer in bytes
// output_size: pointer to store output size (set by function)
// Returns: pointer to WebP-encoded bytes (must be freed with cuda_free)
uint8_t* cuda_process_thumbnail(const uint8_t* input, uint32_t input_size, uint32_t* output_size);

// Blur operation: resize to 320px, apply Gaussian blur, medium-low quality (50%)
// Produces larger files than thumbnail, smaller than low-quality
uint8_t* cuda_process_blur(const uint8_t* input, uint32_t input_size, uint32_t* output_size);

// Low-quality operation: resize to 640px, medium quality (65%)
// Produces the largest processed file, but still smaller than original
uint8_t* cuda_process_low_quality(const uint8_t* input, uint32_t input_size, uint32_t* output_size);

#ifdef __cplusplus
}
#endif

#endif // IMAGE_OPS_H
