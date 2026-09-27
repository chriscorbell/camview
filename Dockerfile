FROM node:24-alpine AS web
WORKDIR /web
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

FROM alexxit/go2rtc:1.9.14 AS go2rtc

# The Relay: go2rtc alone, plus ffmpeg for the audio conversion.
FROM alpine:3.23
RUN apk add --no-cache ffmpeg tini \
    && adduser -S -D -H camview
COPY --from=go2rtc /usr/local/bin/go2rtc /usr/local/bin/go2rtc
COPY relay/go2rtc.yaml /etc/camview/go2rtc.yaml
COPY --from=web /web/dist /usr/share/camview
USER camview
EXPOSE 8080 8555/tcp 8555/udp
ENTRYPOINT ["/sbin/tini", "--", "go2rtc", "-config", "/etc/camview/go2rtc.yaml"]
