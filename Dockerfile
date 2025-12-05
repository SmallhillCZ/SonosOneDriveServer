# Build stage
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /build

# Copy pom.xml first to leverage Docker layer caching
COPY pom.xml .

# Download dependencies (cached if pom.xml hasn't changed)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src/ ./src/

# Build the WAR file
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

# Install Jetty
ENV JETTY_VERSION=9.4.53.v20231009
ENV JETTY_HOME=/opt/jetty
ENV JETTY_BASE=/app

RUN apt-get update && \
    apt-get install -y --no-install-recommends wget && \
    wget -qO- https://repo1.maven.org/maven2/org/eclipse/jetty/jetty-home/${JETTY_VERSION}/jetty-home-${JETTY_VERSION}.tar.gz | tar -xz -C /opt && \
    mv /opt/jetty-home-${JETTY_VERSION} ${JETTY_HOME} && \
    apt-get remove -y wget && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Setup Jetty base
RUN java -jar ${JETTY_HOME}/start.jar --add-module=server,http,deploy,jsp,annotations

# Copy WAR file from builder stage
COPY --from=builder /build/target/*.war ${JETTY_BASE}/webapps/ROOT.war

EXPOSE 3000

# Run Jetty with dynamic port
CMD java -jar ${JETTY_HOME}/start.jar jetty.http.port=3000
