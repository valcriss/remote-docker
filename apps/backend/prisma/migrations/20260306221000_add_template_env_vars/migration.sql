-- CreateTable
CREATE TABLE "CatalogTemplateEnv" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL DEFAULT 'default',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "CatalogTemplateEnv_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CatalogTemplateEnv" ADD CONSTRAINT "CatalogTemplateEnv_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CatalogTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
