-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('CONTAINER', 'COMPOSE');

-- CreateEnum
CREATE TYPE "VolumeMode" AS ENUM ('REMOTE_ONLY', 'SYNC_BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "ConflictPolicy" AS ENUM ('PREFER_LOCAL', 'PREFER_REMOTE', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'OFFLINE',
    "agentVersion" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "TemplateType" NOT NULL,
    "image" TEXT,
    "composeYaml" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogTemplatePort" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'tcp',
    "exposure" TEXT NOT NULL DEFAULT 'FORWARDABLE',

    CONSTRAINT "CatalogTemplatePort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogTemplateVolume" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "mountPath" TEXT NOT NULL,
    "mode" "VolumeMode" NOT NULL DEFAULT 'REMOTE_ONLY',
    "defaultConflictPolicy" "ConflictPolicy" NOT NULL DEFAULT 'PREFER_REMOTE',

    CONSTRAINT "CatalogTemplateVolume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "runtimeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInstancePort" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "remoteHost" TEXT NOT NULL,
    "remotePort" INTEGER NOT NULL,
    "hostPort" INTEGER NOT NULL,

    CONSTRAINT "UserInstancePort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInstanceVolume" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "mountPath" TEXT NOT NULL,
    "serverPath" TEXT NOT NULL,
    "mode" "VolumeMode" NOT NULL,
    "conflictPolicy" "ConflictPolicy" NOT NULL,
    "localPath" TEXT,

    CONSTRAINT "UserInstanceVolume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortForward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "localPort" INTEGER NOT NULL,
    "remoteHost" TEXT NOT NULL,
    "remotePort" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortForward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_userId_key" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogTemplate" ADD CONSTRAINT "CatalogTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogTemplatePort" ADD CONSTRAINT "CatalogTemplatePort_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CatalogTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogTemplateVolume" ADD CONSTRAINT "CatalogTemplateVolume_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CatalogTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstance" ADD CONSTRAINT "UserInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstance" ADD CONSTRAINT "UserInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CatalogTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstancePort" ADD CONSTRAINT "UserInstancePort_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "UserInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstanceVolume" ADD CONSTRAINT "UserInstanceVolume_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "UserInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortForward" ADD CONSTRAINT "PortForward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
