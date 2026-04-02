// MCA PDF Scrubber — Azure Infrastructure
// Deploys: Container Apps Environment + Container Registry + PostgreSQL + Redis

targetScope = 'resourceGroup'

@description('Base name for all resources')
param baseName string = 'mca'

@description('Azure region')
param location string = resourceGroup().location

@description('Container image tag (e.g., latest)')
param imageTag string = 'latest'

@description('Laravel app URL for ingress')
param laravelHostName string = '${baseName}-laravel'

// ─── VARIABLES ────────────────────────────────────────────────────────────────
var uniqueSuffix = uniqueString(resourceGroup().id)
var acrName = 'acr${uniqueSuffix}'
var envName = '${baseName}-env'
var logAnalyticsName = '${baseName}-logs'
var postgresName = 'db${uniqueSuffix}'
var redisName = 'redis${uniqueSuffix}'
var appPlanName = '${baseName}-apps'

// ─── LOG ANALYTICS ────────────────────────────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ─── AZURE CONTAINER REGISTRY ─────────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ─── CONTAINER APPS ENVIRONMENT ───────────────────────────────────────────────
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ─── POSTGRESQL FLEXIBLE SERVER ───────────────────────────────────────────────
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-30' = {
  name: postgresName
  location: location
  sku: {
    name: 'B1s'
    tier: 'Burstable'
  }
  properties: {
    createMode: 'Default'
    version: '15'
    storageGB: 20
    adminUser: 'pgadmin'
    adminPassword: 'TempPass123!'
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-30' = {
  parent: postgres
  name: 'mca_pdf'
  properties: {}
}

// ─── REDIS (AZURE CACHE FOR REDIS) ──────────────────────────────────────────
resource redis 'Microsoft.Cache/Redis@2023-08-01' = {
  name: redisName
  location: location
  sku: {
    name: 'Basic'
    family: 'C'
    capacity: 1
  }
  properties: {
    enableNonSslPort: true
    redisVersion: '7'
  }
}

// ─── CONTAINER APP — LARAVEL ────────────────────────────────────────────────
module laravelApp 'modules/container-app.bicep' = {
  name: 'laravel-app'
  params: {
    baseName: baseName
    location: location
    envName: containerAppsEnv.name
    acrName: acr.name
    imageTag: imageTag
    appHostName: laravelHostName
    containerAppFqdn: laravelHostName
    DB_HOST: postgres.properties.fqdn
    REDIS_HOST: redis.properties.hostName
    OPENROUTER_API_KEY: OPENROUTER_API_KEY
  }
}

// ─── CONTAINER APP — DOCLING (Python PDF service) ────────────────────────────
module doclingApp 'modules/container-app.bicep' = {
  name: 'docling-app'
  params: {
    baseName: '${baseName}-docling'
    location: location
    envName: containerAppsEnv.name
    acrName: acr.name
    imageTag: imageTag
    appHostName: '${baseName}-docling'
    containerAppFqdn: '${baseName}-docling'
    DB_HOST: ''
    REDIS_HOST: ''
    OPENROUTER_API_KEY: OPENROUTER_API_KEY
    targetPort: 8001
    replicaMin: 2
    replicaMax: 5
  }
}

// ─── OUTPUTS ────────────────────────────────────────────────────────────────
output acrLoginServer string = acr.properties.loginServer
output laravelUrl string = 'https://${laravelApp.outputs.fqdn}'
output doclingUrl string = 'https://${doclingApp.outputs.fqdn}'
output postgresHost string = postgres.properties.fqdn
output redisHost string = redis.properties.hostName
output resourceGroup string = resourceGroup().name
