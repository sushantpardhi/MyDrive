package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	QueueNameJobs     = "image:jobs"
	QueueNameRetry    = "image:retry"
	QueueNameFailed   = "image:failed"
	QueueNameDone     = "image:done"
	RedisFetchTimeout = 5 * time.Second
)

type RedisClient struct {
	client *redis.Client
}

func NewRedisClient(addr string, db int) *RedisClient {
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		DB:           db,
		PoolSize:     10,
		MinIdleConns: 5,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	return &RedisClient{client: client}
}

func (rc *RedisClient) FetchJob(ctx context.Context, queueName string) (*Job, error) {
	ctx, cancel := context.WithTimeout(ctx, RedisFetchTimeout)
	defer cancel()

	results, err := rc.client.BRPop(ctx, RedisFetchTimeout, queueName).Result()
	if err != nil {
		if err == redis.Nil || errors.Is(err, context.DeadlineExceeded) {
			return nil, errors.New("timeout")
		}
		return nil, err
	}

	if len(results) < 2 {
		return nil, errors.New("invalid brpop result")
	}

	jobJSON := results[1]
	job := &Job{}
	if err := json.Unmarshal([]byte(jobJSON), job); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job: %v", err)
	}

	return job, nil
}

func (rc *RedisClient) PushToQueue(ctx context.Context, queueName string, job *Job) error {
	jobJSON, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %v", err)
	}

	if err := rc.client.LPush(ctx, queueName, string(jobJSON)).Err(); err != nil {
		return fmt.Errorf("failed to push to queue %s: %v", queueName, err)
	}

	return nil
}

func (rc *RedisClient) MoveToSuccess(ctx context.Context, job *Job) error {
	jobJSON, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %v", err)
	}

	if err := rc.client.LPush(ctx, QueueNameDone, string(jobJSON)).Err(); err != nil {
		return fmt.Errorf("failed to push to done queue: %v", err)
	}

	return nil
}

func (rc *RedisClient) MoveToFailed(ctx context.Context, job *Job) error {
	jobJSON, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %v", err)
	}

	if err := rc.client.LPush(ctx, QueueNameFailed, string(jobJSON)).Err(); err != nil {
		return fmt.Errorf("failed to push to failed queue: %v", err)
	}

	return nil
}

func (rc *RedisClient) Close() error {
	return rc.client.Close()
}
