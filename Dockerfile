FROM node:8

RUN set -ex;mkdir -p /data/ \
    && apt-get update && apt-get install -y --no-install-recommends locales traceroute telnet \
    && sed -i -e 's/# zh_CN.UTF-8 UTF-8/zh_CN.UTF-8 UTF-8/' /etc/locale.gen \
    && dpkg-reconfigure --frontend=noninteractive locales \
    && update-locale LANG=zh_CN.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Shanghai LANG=zh_CN.UTF-8 LC_ALL=zh_CN.UTF-8

WORKDIR /data

CMD ["node", "server.js" ]

ENTRYPOINT ["/data/scripts/docker-entrypoint.sh"]

ADD package*.json /data/

# install package
RUN cd /data && npm install --save-prod

ADD . .


