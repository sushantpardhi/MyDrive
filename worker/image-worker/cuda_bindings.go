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

func CudaProcessThumbnail(imageData []byte) []byte {
	if len(imageData) == 0 {
		return nil
	}

	inputPtr := (*C.uchar)(unsafe.Pointer(&imageData[0]))
	inputSize := C.uint(len(imageData))
	var outputSize C.uint

	outputPtr := C.cuda_process_thumbnail(inputPtr, inputSize, &outputSize)
	if outputPtr == nil {
		return nil
	}

	defer C.cuda_free(unsafe.Pointer(outputPtr))

	output := C.GoBytes(unsafe.Pointer(outputPtr), C.int(outputSize))
	return output
}

func CudaProcessBlur(imageData []byte) []byte {
	if len(imageData) == 0 {
		return nil
	}

	inputPtr := (*C.uchar)(unsafe.Pointer(&imageData[0]))
	inputSize := C.uint(len(imageData))
	var outputSize C.uint

	outputPtr := C.cuda_process_blur(inputPtr, inputSize, &outputSize)
	if outputPtr == nil {
		return nil
	}

	defer C.cuda_free(unsafe.Pointer(outputPtr))

	output := C.GoBytes(unsafe.Pointer(outputPtr), C.int(outputSize))
	return output
}

func CudaProcessLowQuality(imageData []byte) []byte {
	if len(imageData) == 0 {
		return nil
	}

	inputPtr := (*C.uchar)(unsafe.Pointer(&imageData[0]))
	inputSize := C.uint(len(imageData))
	var outputSize C.uint

	outputPtr := C.cuda_process_low_quality(inputPtr, inputSize, &outputSize)
	if outputPtr == nil {
		return nil
	}

	defer C.cuda_free(unsafe.Pointer(outputPtr))

	output := C.GoBytes(unsafe.Pointer(outputPtr), C.int(outputSize))
	return output
}
