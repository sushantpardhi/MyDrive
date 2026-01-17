package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
)

// QualitySettings defines WebP encoding quality for each operation
type QualitySettings struct {
	Thumbnail  int // 30% - smallest file
	Blur       int // 50% - medium-small file
	LowQuality int // 70% - medium file
}

var qualitySettings = QualitySettings{
	Thumbnail:  30,
	Blur:       50,
	LowQuality: 70,
}

// DecodeImage decodes JPEG/PNG/WebP to raw RGB pixels
func DecodeImage(imageData []byte) ([]byte, int, int, error) {
	img, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, 0, 0, fmt.Errorf("failed to decode image: %w", err)
	}

	// Convert to RGBA then extract RGB
	bounds := img.Bounds()
	width, height := bounds.Dx(), bounds.Dy()

	// Convert to NRGBA for consistent pixel access
	nrgba := imaging.Clone(img)

	// Extract RGB bytes (drop alpha channel)
	rgb := make([]byte, width*height*3)
	idx := 0
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r, g, b, _ := nrgba.At(x, y).RGBA()
			rgb[idx] = byte(r >> 8)
			rgb[idx+1] = byte(g >> 8)
			rgb[idx+2] = byte(b >> 8)
			idx += 3
		}
	}

	return rgb, width, height, nil
}

// EncodeWebP encodes RGB pixels to WebP with specified quality
func EncodeWebP(rgb []byte, width, height, quality int) ([]byte, error) {
	// Create NRGBA image from RGB data
	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	idx := 0
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.SetNRGBA(x, y, color.NRGBA{
				R: rgb[idx],
				G: rgb[idx+1],
				B: rgb[idx+2],
				A: 255,
			})
			idx += 3
		}
	}

	// Encode to WebP
	var buf bytes.Buffer
	if err := webp.Encode(&buf, img, &webp.Options{Quality: float32(quality)}); err != nil {
		return nil, fmt.Errorf("failed to encode WebP: %w", err)
	}

	return buf.Bytes(), nil
}

// GetQuality returns the appropriate WebP quality for an operation
func GetQuality(operation string) int {
	switch operation {
	case "thumbnail":
		return qualitySettings.Thumbnail
	case "blur":
		return qualitySettings.Blur
	case "low-quality":
		return qualitySettings.LowQuality
	default:
		return 75
	}
}
