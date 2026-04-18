import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const p = new PrismaClient();
(async () => {
    try {
        const user = await p.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        if (!user) { console.error('No admin found'); process.exit(1); }
        const token = crypto.randomBytes(32).toString('hex');
        await p.session.create({
            data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3600000) }
        });
        const ut = await p.userTenant.findFirst({ where: { userId: user.id, removedAt: null } });
        console.log(JSON.stringify({ token, userId: user.id, tenantId: ut ? ut.tenantId : null }));
    } catch (e) {
        console.error(e);
    } finally {
        await p.$disconnect();
    }
})();
