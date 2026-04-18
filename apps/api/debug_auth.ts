
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Tenants ---');
    const tenants = await prisma.tenant.findMany();
    console.table(tenants.map(t => ({ id: t.id, name: t.name })));

    console.log('\n--- Auth Providers ---');
    const providers = await prisma.authProvider.findMany();
    console.table(providers.map(p => ({
        id: p.id,
        tenantId: p.tenantId,
        type: p.type,
        clientId: p.clientId
    })));

    console.log('\n--- Checking specific defaults ---');
    const defaultClientId = '0323d177-f9bd-43e7-937c-57cabad8b932';
    const defaultMsTenantId = '8bfad545-8650-4872-a917-20c9720b906b';

    const providerByClient = await prisma.authProvider.findFirst({
        where: { clientId: defaultClientId }
    });
    console.log(`Provider for ClientID ${defaultClientId}:`, providerByClient ? 'Found' : 'MISSING');

    const tenantById = await prisma.tenant.findUnique({
        where: { id: defaultMsTenantId }
    });
    console.log(`Tenant for MS TenantID ${defaultMsTenantId}:`, tenantById ? 'Found' : 'MISSING');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
