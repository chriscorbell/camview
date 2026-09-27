FROM node:24-alpine AS web
WORKDIR /web
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

# go2rtc from its pinned release, patched to serve only the configured streams.
FROM golang:1.25-alpine AS go2rtc
ARG GO2RTC_VERSION=v1.9.14
RUN apk add --no-cache git patch \
    && git clone --depth 1 --branch "$GO2RTC_VERSION" https://github.com/AlexxIT/go2rtc /src
WORKDIR /src
COPY relay/serve-configured-streams-only.patch ./
RUN patch -p1 < serve-configured-streams-only.patch \
    && CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /go2rtc .

# The Relay: go2rtc alone, plus ffmpeg and the AMD VAAPI driver for the
# audio conversion and the Desk display's 1080p conversion.
FROM alpine:3.23
RUN apk add --no-cache ffmpeg mesa-va-gallium tini \
    && adduser -S -D -H camview
COPY --from=go2rtc /go2rtc /usr/local/bin/go2rtc
COPY relay/go2rtc.yaml /etc/camview/go2rtc.yaml
COPY --from=web /web/dist /usr/share/camview
USER camview
EXPOSE 8080 8555/tcp 8555/udp
ENTRYPOINT ["/sbin/tini", "--", "go2rtc", "-config", "/etc/camview/go2rtc.yaml"]
