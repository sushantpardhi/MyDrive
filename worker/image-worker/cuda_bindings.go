package main

// #cgo CFLAGS: -I./cuda
// #cgo LDFLAGS: -lcuda -lcudart
// #include "image_ops.h"
// #include <stdlib.h>
import "C"

import (
	"fmt"
	"unsafe"
)

func CudaInit() error {
	ret := C.cuda_init()
	if ret != 0 {
		return fmt.Errorf("CUDA initialization failed with code %d", ret)
	}
	return nil
}

func CudaCleanup() {
	C.cuda_cleanup()
}

// CudaProcessThumbnail processes thumbnail with 64px max dimension
// Returns raw RGB pixels to be encoded as WebP quality 30
func CudaProcessThumbnail(rgbData []byte, width, height int) ([]byte, int, int, error) {
	if len(rgbData) == 0 {
		return nil, 0, 0, fmt.Errorf("empty input data")
	}

	inputPtr := (*C.uchar)(unsafe.Pointer(&rgbData[0]))
	var outputSize C.uint
	var outWidth, outHeight C.int

	outputPtr := C.cuda_process_thumbnail(inputPtr, C.int(width), C.int(height),
		&outputSize, &outWidth, &outHeight)
	if outputPtr == nil {
		return nil, 0, 0, fmt.Errorf("CUDA thumbnail processing failed")
	}

	defer C.cuda_free(unsafe.Pointer(outputPtr))

	output := C.GoBytes(unsafe.Pointer(outputPtr), C.int(outputSize))
	return output, int(outWidth), int(outHeight), nil
}

// CudaProcessBlur processes blur with 256px max dimension
// Returns raw RGB pixels to be encoded as WebP quality 50
func CudaProcessBlur(rgbData []byte, width, height int) ([]byte, int, int, error) {
	if len(rgbData) == 0 {
		return nil, 0, 0, fmt.Errorf("empty input data")
	}

	inputPtr := (*C.uchar)(unsafe.Pointer(&rgbData[0]))
	var outputSize C.uint
	var outWidth, outHeight C.int

	outputPtr := C.cuda_process_blur(inputPtr, C.int(width), C.int(height),
		&outputSize, &outWidth, &outHeight)
	if outputPtr == nil {
		return nil, 0, 0, fmt.Errorf("CUDA blur processing failed")
	}

	defer C.cuda_free(unsafe.Pointer(outputPtr))

	output := C.GoBytes(unsafe.Pointer(outputPtr), C.int(outputSize))
	return output, int(outWidth), int(outHeight), nil
}

// CudaProcessLowQuality processes low-quality with 512px max dimension
// Returns raw RGB pixels to be encoded as WebP quality 70
func CudaProcessLowQuality(rgbData []byte, width, height int) ([]byte, int, int, error) {
	if len(rgbData) == 0 {
		return nil, 0, 0, fmt.Errorf("empty input data")
	}

	inputPtr := (*C.uchar)(unsafe.Pointer(&rgbData[0]))
	var outputSize C.uint
	var outWidth, outHeight C.int

	outputPtr := C.cuda_process_low_quality(inputPtr, C.int(width), C.int(height),
		&outputSize, &outWidth, &outHeight)
	if outputPtr == nil {
		return nil, 0, 0, fmt.Errorf("CUDA low-quality processing failed")
	}

	defer C.cuda_free(unsafe.Pointer(outputPtr))

	output := C.GoBytes(unsafe.Pointer(outputPtr), C.int(outputSize))
	return output, int(outWidth), int(outHeight), nil
}
