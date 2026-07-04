# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/devcontainers/base:bookworm

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    bubblewrap \
    ca-certificates \
    curl \
    fd-find \
    git \
    gnupg \
    iproute2 \
    jq \
    less \
    openssh-client \
    procps \
    python3 \
    python3-pip \
    ripgrep \
    unzip \
  && rm -rf /var/lib/apt/lists/*
