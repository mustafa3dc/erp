# ==============================================================================
# Multi-Stage Production Dockerfile for Render / Cloud Deployment
# Architecture: React / Vite Frontend + C# .NET 8 Web API (Integrated)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Build Frontend SPA (React + TypeScript + Vite)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /build/frontend

COPY web-dashboard/package*.json ./
RUN npm ci

COPY web-dashboard/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# 2. Build Backend (.NET 8 Web API)
# ------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS backend-builder
WORKDIR /build/backend

COPY backend/*.csproj ./
RUN dotnet restore

COPY backend/ ./
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# ------------------------------------------------------------------------------
# 3. Final Production Runtime Image
# ------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final
WORKDIR /app

# Copy compiled backend binaries
COPY --from=backend-builder /app/publish ./

# Copy built frontend assets directly into backend's static wwwroot directory
COPY --from=frontend-builder /build/frontend/dist ./wwwroot

# Copy SQL initialization schema for auto-bootstrapping
COPY database/render_full_init.sql ./database/render_full_init.sql

# Production Environment Variables for Render
ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=10000
ENV ASPNETCORE_URLS=http://+:10000

EXPOSE 10000

ENTRYPOINT ["dotnet", "ERP.Warehouse.Api.dll"]

