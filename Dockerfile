FROM busybox@sha256:bdf57e528e45e4433820e045b29b4597825a1c9e38353532d90a01445013f82e
ARG SOURCE_REVISION
LABEL org.opencontainers.image.revision=$SOURCE_REVISION
COPY dist/ /site/
COPY httpd.conf /etc/site-httpd.conf
USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=2s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/
CMD ["httpd", "-f", "-p", "8080", "-h", "/site", "-c", "/etc/site-httpd.conf"]
