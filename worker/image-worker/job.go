package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
)

type Job struct {
	JobID      string   `json:"jobId"`
	InputPath  string   `json:"inputPath"`
	OutputDir  string   `json:"outputDir"`
	Operations []string `json:"operations"`
	Timestamp  int64    `json:"timestamp"`
	RetryCount int      `json:"retryCount"`
}

func (j *Job) Validate() error {
	if j.JobID == "" {
		return errors.New("jobId is required")
	}

	if j.InputPath == "" {
		return errors.New("inputPath is required")
	}

	if _, err := os.Stat(j.InputPath); os.IsNotExist(err) {
		return fmt.Errorf("input file not found: %s", j.InputPath)
	}

	if len(j.Operations) == 0 {
		return errors.New("operations list is empty")
	}

	validOps := map[string]bool{
		"thumbnail":   true,
		"blur":        true,
		"low-quality": true,
	}

	for _, op := range j.Operations {
		if !validOps[op] {
			return fmt.Errorf("invalid operation: %s", op)
		}
	}

	return nil
}

func (j *Job) MarshalJSON() ([]byte, error) {
	type Alias Job
	return json.Marshal(&struct {
		*Alias
	}{
		Alias: (*Alias)(j),
	})
}

func (j *Job) UnmarshalJSON(data []byte) error {
	type Alias Job
	aux := &struct {
		*Alias
	}{
		Alias: (*Alias)(j),
	}
	return json.Unmarshal(data, &aux)
}
