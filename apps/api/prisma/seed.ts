import { PrismaClient } from '@prisma/client';
import { CORE_FEATURES } from '@surdej/core';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding database...');

    // ─── Demo Tenant ───
    const demoTenant = await prisma.tenant.upsert({
        where: { slug: 'demo-burger' },
        update: {
            name: 'Demo - Burger Restaurant',
            description: 'A fictional fast-food franchise for demonstration purposes',
        },
        create: {
            id: 'tenant-demo-burger',
            name: 'Demo - Burger Restaurant',
            slug: 'demo-burger',
            description: 'A fictional fast-food franchise for demonstration purposes',
            isDemo: true,
            metadata: {
                industry: 'food-service',
                locale: 'en-US',
                timezone: 'America/New_York',
                brandColor: '#DA291C',
            },
        },
    });
    console.log(`  ✓ Demo tenant: ${demoTenant.name} (${demoTenant.slug})`);

    // ─── Demo Users ───
    const pinHash = await bcrypt.hash('1234', 10);
    const users = [
        { email: 'admin@surdej.dev', name: 'Admin User', displayName: 'Admin', role: 'SUPER_ADMIN' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4511111111', pinHash },
        { email: 'developer@surdej.dev', name: 'Developer', displayName: 'Dev', role: 'ADMIN' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4522222222', pinHash },
        { email: 'member@surdej.dev', name: 'Team Member', displayName: 'Member', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4533333333', pinHash },
        { email: 'guest@surdej.dev', name: 'Guest User', displayName: 'Guest', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4544444444', pinHash },
        { email: 'lene@demo-burger.surdej.dev', name: 'Lene', displayName: 'Lene', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4551111111', pinHash },
        { email: 'puff@demo-burger.surdej.dev', name: 'Puff', displayName: 'Puff', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4552222222', pinHash },
        { email: 'henrik@demo-burger.surdej.dev', name: 'Henrik', displayName: 'Henrik', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4553333333', pinHash },
        { email: 'mikkel@demo-burger.surdej.dev', name: 'Mikkel', displayName: 'Mikkel', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4554444444', pinHash },
        { email: 'viktor@demo-burger.surdej.dev', name: 'Viktor', displayName: 'Viktor', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4555555555', pinHash },
        { email: 'betina@demo-burger.surdej.dev', name: 'Betina', displayName: 'Betina', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4556666666', pinHash },
        { email: 'oskar@demo-burger.surdej.dev', name: 'Oskar', displayName: 'Oskar', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4557777777', pinHash },
        { email: 'asger@demo-burger.surdej.dev', name: 'Asger', displayName: 'Asger', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4558888888', pinHash },
        { email: 'isabel@demo-burger.surdej.dev', name: 'Isabel', displayName: 'Isabel', role: 'MEMBER' as const, isDemoUser: true, tenantId: demoTenant.id, phone: '+4559999999', pinHash },
    ];

    for (const userData of users) {
        await prisma.user.upsert({
            where: { email: userData.email },
            update: userData,
            create: userData,
        });
    }
    console.log(`  ✓ ${users.length} demo users (tenant: ${demoTenant.slug})`);

    // ─── Tenant Domains (active tenants only) ───
    const domains = [
        { domain: 'surdej.dev', tenantId: demoTenant.id },
    ];

    for (const d of domains) {
        await prisma.tenantDomain.upsert({
            where: { tenantId_domain: { tenantId: d.tenantId, domain: d.domain } },
            update: { verified: true },
            create: { domain: d.domain, tenantId: d.tenantId, verified: true, isPrimary: true },
        });
    }
    console.log(`  ✓ ${domains.length} tenant domains`);

    // ─── Feature Flags ───
    for (const feature of CORE_FEATURES) {
        await prisma.featureFlag.upsert({
            where: { featureId: feature.id },
            update: {
                title: feature.title,
                description: feature.description ?? null,
                ring: feature.ring,
                enabledByDefault: feature.enabledByDefault,
                category: feature.category ?? null,
            },
            create: {
                featureId: feature.id,
                title: feature.title,
                description: feature.description ?? null,
                ring: feature.ring,
                enabledByDefault: feature.enabledByDefault,
                category: feature.category ?? null,
            },
        });
    }
    console.log(`  ✓ ${CORE_FEATURES.length} feature flags`);

    // ─── Built-in Skins ───
    const defaultSkin = await prisma.skin.upsert({
        where: { id: 'skin-default' },
        update: {
            sidebar: [
                { commandId: 'navigate.home', group: 'Core', order: 1 },
                { commandId: 'navigate.chat', group: 'Core', order: 2 },
                { commandId: 'navigate.knowledge', group: 'Core', order: 3 },
                { commandId: 'navigate.processes', group: 'Core', order: 4 },
                { commandId: 'navigate.projects', group: 'Core', order: 5 },
                { commandId: 'navigate.help', group: 'Support', order: 6 },
            ],
            activityBar: [
                { id: 'home', label: 'Overview', icon: 'Home', path: '' },
                { id: 'database', label: 'Database', icon: 'Database', path: '/database' },
            ],
        },
        create: {
            id: 'skin-default',
            name: 'Default',
            description: 'Full platform experience with all navigation items',
            isBuiltIn: true,
            branding: {
                title: 'Surdej',
                subtitle: 'Application Framework',
            },
            sidebar: [
                { commandId: 'navigate.home', group: 'Core', order: 1 },
                { commandId: 'navigate.chat', group: 'Core', order: 2 },
                { commandId: 'navigate.knowledge', group: 'Core', order: 3 },
                { commandId: 'navigate.processes', group: 'Core', order: 4 },
                { commandId: 'navigate.projects', group: 'Core', order: 5 },
                { commandId: 'navigate.help', group: 'Support', order: 6 },
            ],
            activityBar: [
                { id: 'home', label: 'Overview', icon: 'Home', path: '' },
                { id: 'database', label: 'Database', icon: 'Database', path: '/database' },
            ],
            theme: { defaultMode: 'dark' },
        },
    });

    const minimalSkin = await prisma.skin.upsert({
        where: { id: 'skin-minimal' },
        update: {
            activityBar: [
                { id: 'home', label: 'Overview', icon: 'Home', path: '' },
            ],
        },
        create: {
            id: 'skin-minimal',
            name: 'Minimal',
            description: 'Clean, distraction-free experience',
            isBuiltIn: true,
            branding: {
                title: 'Surdej',
                subtitle: '',
            },
            sidebar: [
                { commandId: 'navigate.home', group: 'Main', order: 1 },
                { commandId: 'navigate.settings', group: 'System', order: 90 },
            ],
            activityBar: [
                { id: 'home', label: 'Overview', icon: 'Home', path: '' },
            ],
            theme: { defaultMode: 'light' },
        },
    });

    console.log(`  ✓ 2 built-in skins (${defaultSkin.name}, ${minimalSkin.name})`);

    // ─── Reference: get admin user ID ───
    const admin = await prisma.user.findUnique({ where: { email: 'admin@surdej.dev' } });
    const developer = await prisma.user.findUnique({ where: { email: 'developer@surdej.dev' } });
    const member = await prisma.user.findUnique({ where: { email: 'member@surdej.dev' } });
    const guest = await prisma.user.findUnique({ where: { email: 'guest@surdej.dev' } });
    if (!admin || !developer || !member || !guest) throw new Error('Demo users not found — run base seed first');

    // ─── Knowledge Templates (McDonald's franchise) ───
    const sopTemplate = await prisma.template.upsert({
        where: { name: 'Standard Operating Procedure' },
        update: {},
        create: {
            name: 'Standard Operating Procedure',
            description: 'Template for McDonald\'s station SOPs — step-by-step procedures with safety notes.',
            sections: [
                { title: 'Purpose & Scope', contentType: 'text', required: true },
                { title: 'Equipment Required', contentType: 'checklist', required: true },
                { title: 'Step-by-Step Procedure', contentType: 'rich-text', required: true },
                { title: 'Safety & Hygiene Notes', contentType: 'text', required: true },
                { title: 'Quality Checkpoints', contentType: 'checklist', required: false },
                { title: 'Troubleshooting', contentType: 'table', required: false },
            ],
            isDefault: false,
        },
    });

    const equipmentTemplate = await prisma.template.upsert({
        where: { name: 'Equipment Maintenance Guide' },
        update: {},
        create: {
            name: 'Equipment Maintenance Guide',
            description: 'Covers daily/weekly/monthly maintenance, calibration, and troubleshooting for kitchen equipment.',
            sections: [
                { title: 'Equipment Overview', contentType: 'text', required: true },
                { title: 'Daily Maintenance Checklist', contentType: 'checklist', required: true },
                { title: 'Weekly Deep-Clean Procedure', contentType: 'rich-text', required: true },
                { title: 'Monthly Calibration', contentType: 'table', required: false },
                { title: 'Common Issues & Fixes', contentType: 'table', required: true },
                { title: 'When to Call Service', contentType: 'text', required: false },
            ],
            isDefault: false,
        },
    });

    const trainingTemplate = await prisma.template.upsert({
        where: { name: 'Crew Training Manual' },
        update: {},
        create: {
            name: 'Crew Training Manual',
            description: 'Structured training content for new and existing crew members.',
            sections: [
                { title: 'Learning Objectives', contentType: 'checklist', required: true },
                { title: 'Background & Context', contentType: 'text', required: true },
                { title: 'Core Skills', contentType: 'rich-text', required: true },
                { title: 'Practice Scenarios', contentType: 'rich-text', required: false },
                { title: 'Assessment Questions', contentType: 'checklist', required: true },
                { title: 'Additional Resources', contentType: 'text', required: false },
            ],
            isDefault: false,
        },
    });

    console.log(`  ✓ 3 knowledge templates`);

    // ─── Knowledge Articles ───
    const articleData = [
        {
            title: 'Grill Station Operating Procedure',
            slug: 'grill-station-operating-procedure',
            status: 'published',
            authorId: admin.id,
            templateId: sopTemplate.id,
            tags: ['sop', 'grill', 'kitchen', 'cooking'],
            publishedAt: new Date('2026-01-15'),
            content: `# Grill Station Operating Procedure

## Purpose & Scope

This SOP covers the correct operation of the McDonald's grill station, including patty cooking, bun toasting, and quality standards for all beef products (Quarter Pounder, Big Mac, McDouble, Hamburger, Cheeseburger).

**Applies to:** All crew members assigned to the grill station during any shift.

## Equipment Required

- ☑ Clam-shell grill (primary)
- ☑ Flat-top grill (backup)
- ☑ Bun toaster
- ☑ UHC (Universal Holding Cabinet) with timers
- ☑ Meat thermometer (digital, calibrated)
- ☑ Spatula set (flat + slotted)
- ☑ Grill scraper
- ☑ Non-stick spray
- ☑ Disposable gloves (blue, food-safe)

## Step-by-Step Procedure

### 1. Pre-Shift Setup (10 minutes before opening)
1. Turn on clam-shell grill — verify temp reaches **400°F (204°C)** for regular meat, **350°F (177°C)** for Quarter Pounder.
2. Run bun toaster through one empty cycle to pre-heat.
3. Stock the landing area with parchment sheets.
4. Check frozen patty inventory — minimum **2 sleeves per size** at station start.

### 2. Cooking Regular Patties (10:1 meat)
| Step | Action | Time |
|------|--------|------|
| 1 | Place frozen patties on grill (max 8 per cycle) | - |
| 2 | Close clam-shell lid | - |
| 3 | Cook until timer beeps | **38 seconds** |
| 4 | Season with salt & pepper from dispenser | 1 shake each |
| 5 | Transfer to UHC tray | Within 5 sec |

### 3. Cooking Quarter Pounder Patties (4:1 meat)
- **Temperature:** 350°F (177°C)
- **Cook time:** 65 seconds (clam-shell)
- **Important:** Quarter Pounder patties are cooked **fresh to order** — never pre-stage in UHC.
- Season immediately after cooking.

### 4. Bun Toasting
- Crown and heel go **cut-side down** in toaster
- Toast time: **25 seconds** at standard setting
- Inspect for even browning — reject if >30% untoasted

## Safety & Hygiene Notes

⚠️ **Critical Temperature:** Internal temp of all beef patties must reach **160°F (71°C)** minimum. Check with probe thermometer every 30 minutes.

- Wash hands before touching any food surface.
- Change gloves every 30 minutes or when switching between raw and cooked product.
- Never reuse parchment sheets.
- Clean grill surface with scraper between batches if char buildup is visible.

## Quality Checkpoints

- ☑ Patty is evenly browned on both sides
- ☑ No pink visible in center (visual check)
- ☑ Bun is lightly toasted, not burnt
- ☑ UHC timer running — discard after **15 minutes** (regular) or immediately (QP)
- ☑ Station is clean and restocked before handoff

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Patties sticking | Grill not hot enough | Allow 5 min extra pre-heat |
| Uneven cooking | Clam-shell misaligned | Call maintenance, use flat-top |
| Buns too dark | Toaster temp too high | Recalibrate to setting 3 |
| Timer not beeping | Low battery or defect | Replace batteries / use phone timer |
`,
        },
        {
            title: 'Food Safety & HACCP Compliance Guide',
            slug: 'food-safety-haccp-compliance',
            status: 'published',
            authorId: developer.id,
            templateId: null,
            tags: ['food-safety', 'haccp', 'compliance', 'health'],
            publishedAt: new Date('2026-01-10'),
            content: `# Food Safety & HACCP Compliance Guide

## Overview

All McDonald's franchise locations must adhere to a Hazard Analysis and Critical Control Points (HACCP) plan. This guide covers the **7 HACCP principles** as they apply to daily restaurant operations.

## Temperature Control — The Danger Zone

The bacterial danger zone is **41°F – 135°F (5°C – 57°C)**. Food must not remain in this range for more than **4 hours cumulative**.

### Receiving Standards

| Product | Accept Below | Reject Above |
|---------|-------------|-------------|
| Fresh beef | 41°F (5°C) | 45°F (7°C) |
| Frozen patties | 0°F (–18°C) | 10°F (–12°C) |
| Fresh produce | 41°F (5°C) | 45°F (7°C) |
| Dairy (milk, cheese) | 41°F (5°C) | 45°F (7°C) |
| Chicken nuggets (frozen) | 0°F (–18°C) | 10°F (–12°C) |

### Holding Times

- **UHC hot holding:** 15 min (regular patties), fresh-to-order (Quarter Pounder)
- **Prepped lettuce/tomato:** 4 hours max after cutting
- **Sauce wells:** 4 hours, then discard and refill
- **Fried products (fries, nuggets, fish):** 7 minutes max under heat lamp

## Cleaning & Sanitizing Schedule

### Every 2 Hours
- Wipe all contact surfaces with sanitizer (200 ppm Quaternary ammonium)
- Empty and sanitize sauce guns
- Check hand-wash station soap/towel supply

### Every 4 Hours
- Deep clean of prep table surfaces
- Change sanitizer bucket solution
- Temp-check walk-in cooler and freezer (log on sheet)

### Daily Close
- Break down and sanitize all equipment (grill, fryers, shake machine)
- Mop all floors with floor sanitizer
- Drain and clean grease traps (weekly — but check level daily)
- Complete the **Daily Food Safety Checklist** and file in the HACCP binder

## Employee Health Policy

Crew members **must not** work if they have:
- Vomiting or diarrhea (within last 24 hours)
- Diagnosed with norovirus, Salmonella, Shigella, E. coli, or Hepatitis A
- Infected wound on hands/arms (unless properly bandaged + gloved)
- Fever above 100.4°F (38°C)

Report to shift manager immediately. Document on the **Employee Illness Log**.

## Allergen Awareness

Key allergens present in McDonald's menu items:
1. **Wheat/Gluten** — buns, batter, pie crust
2. **Dairy/Milk** — cheese, ice cream, McFlurry toppings
3. **Soy** — cooking oil, bun ingredients
4. **Eggs** — breakfast items, sauces
5. **Fish** — Filet-O-Fish
6. **Tree nuts** — seasonal items (check current menu advisory)

**Procedure:** If a customer reports an allergy, escalate to the shift manager. Use dedicated prep area if available. Never guarantee allergen-free.
`,
        },
        {
            title: 'Drive-Thru Speed of Service Standards',
            slug: 'drive-thru-speed-of-service',
            status: 'review',
            authorId: member.id,
            templateId: sopTemplate.id,
            tags: ['drive-thru', 'speed', 'service', 'operations'],
            content: `# Drive-Thru Speed of Service Standards

## Purpose & Scope

Drive-thru accounts for **65–70% of revenue** in most McDonald's locations. This document defines the target service times and crew positions to maintain speed and accuracy.

## Target Times

| Metric | Target | Measured From → To |
|--------|--------|-------------------|
| **OEPE** (Order-End to Present-End) | ≤ 90 sec | Order confirmation → food presented at window |
| **Total Experience Time** | ≤ 210 sec | Arrival at menu board → departure from window |
| **Presenter idle** | ≤ 15 sec | Between vehicles at present window |

## Crew Positioning (Peak Hours)

During peak (11:00–13:00, 17:00–19:00), the drive-thru requires **minimum 4 dedicated positions:**

1. **Order Taker (OT)** — headset, greets customer, inputs order
2. **Order Assembler (OA)** — builds orders in DT staging area
3. **Cashier/Presenter** — takes payment, hands out food, verifies order
4. **Runner** — fills drinks, bags items, expedites

## Common Bottlenecks

- **Menu board wait > 30 sec:** Add a second OT or use line-busting tablet
- **Payment delays:** Ensure card reader is functioning, have backup terminal ready
- **Order accuracy < 95%:** Implement read-back at OT, double-check at presenter
- **Cars stacking past lane:** Activate "park and wait" for complex orders (> 3 items custom)

## Quality at Speed

Speed must not compromise quality:
- Every bag gets a **sticker seal**
- Presenter does a **3-point check**: drinks, mains, sides/dessert
- If an item is missing, apologize and deliver within 60 sec — do NOT ask car to re-enter lane
`,
        },
        {
            title: 'Deep Fryer Equipment Maintenance Guide',
            slug: 'deep-fryer-maintenance-guide',
            status: 'approved',
            authorId: admin.id,
            templateId: equipmentTemplate.id,
            tags: ['equipment', 'fryer', 'maintenance', 'kitchen'],
            content: `# Deep Fryer Equipment Maintenance Guide

## Equipment Overview

McDonald's standard deep fryers:
- **Henny Penny LOV** (Low Oil Volume) — primary fryer for fries, nuggets, fish
- Capacity: 2 × 30 lb oil vats
- Oil type: High-oleic canola blend (trans-fat free)
- Operating temp: **335°F (168°C)** for fries, **350°F (177°C)** for chicken products

## Daily Maintenance Checklist

- ☑ Filter oil through built-in filtration system (minimum 2× daily)
- ☑ Check oil level — top off if below MIN line
- ☑ Wipe exterior surfaces with degreaser
- ☑ Clean and sanitize basket handles
- ☑ Verify thermostat accuracy with probe thermometer (±5°F tolerance)
- ☑ Check drain valve is fully closed and not leaking
- ☑ Log oil quality score (1–5 scale) on Fryer Quality Sheet

## Weekly Deep-Clean Procedure

### Boil-Out Procedure (Every Monday, after close)
1. **Drain** vats completely into waste oil container.
2. Refill with water + fryer cleaning solution (2 oz per gallon).
3. Set temperature to **200°F (93°C)** and boil for **20 minutes**.
4. **Drain**, then scrub interior with nylon brush — no metal tools!
5. Rinse twice with clean hot water.
6. Dry thoroughly — any residual water causes oil spatter.
7. Refill with fresh oil.
8. Season new oil: fry a batch of fries for 3 minutes before serving.

## Common Issues & Fixes

| Issue | Cause | Solution |
|-------|-------|----------|
| Oil foaming excessively | Contamination or old oil | Replace oil immediately |
| Fries too dark | Oil temp too high or old oil | Recalibrate thermostat, check oil quality |
| Slow recovery time | Heating element failing | Schedule service call (part #HEN-4107) |
| Basket won't latch | Bent hook | Bend back gently or replace basket |
| Oil tastes off | Cross-contamination | Filter, or replace if TPC > 24% |

## When to Call Service

- Heating element not reaching temp within 15 min
- Oil leak from drain or housing
- Electronic controls unresponsive
- Any gas smell (evacuate, call fire department first, then service)
`,
        },
        {
            title: 'Shift Manager Closing Procedures',
            slug: 'shift-manager-closing-procedures',
            status: 'draft',
            authorId: developer.id,
            templateId: null,
            tags: ['management', 'closing', 'shift', 'operations'],
            content: `# Shift Manager Closing Procedures

## Overview

The closing shift manager is responsible for securing the restaurant, completing financial reconciliation, and ensuring the store is ready for the opening crew. Typical close takes **60–90 minutes** after last customer.

## Timeline

| Time | Task |
|------|------|
| 30 min before close | Begin pre-close: shut down one grill, one fryer, start cleaning |
| Last order | Lock doors, switch sign to closed |
| +15 min | Complete all food disposal, break down stations |
| +30 min | Run register reports, count drawers and safe |
| +45 min | Final floor clean, restroom check, take out trash |
| +60 min | Set alarm, lock up, complete closing checklist in app |

## Register & Cash Procedures

1. **Print Z-Report** from each register terminal
2. Count each drawer — must match Z-Report ±$1.00
3. **Over/Short Log:** Record any discrepancies > $1.00. Over $10.00 triggers manager review.
4. Prepare bank deposit: all bills > $200 in drawer → deposit bag
5. Seal deposit bag, initial seal, drop in safe
6. Lock safe and spin combination

## Security Checklist

- ☑ All exterior doors locked and tested
- ☑ Back door (receiving) dead-bolted
- ☑ Parking lot lights on (timer should be automatic)
- ☑ Safe locked and spun
- ☑ Alarm armed — you have 60 seconds to exit
- ☑ Security cameras confirmed recording (check monitor)
- ☑ Crew members have left the building before you

## Food Waste & Inventory

- Count and log all food waste using the **Waste Sheet** in the manager app
- Enter tomorrow's prep estimates based on projected traffic (check calendar for events)
- Verify walk-in temp: cooler ≤ 40°F, freezer ≤ 0°F
- If inventory is below **par levels**, leave a note for the opening manager
`,
        },
        {
            title: 'Handling Customer Complaints & Recovery',
            slug: 'customer-complaints-and-recovery',
            status: 'published',
            authorId: admin.id,
            templateId: trainingTemplate.id,
            tags: ['customer-service', 'complaints', 'training', 'recovery'],
            publishedAt: new Date('2026-02-01'),
            content: `# Handling Customer Complaints & Recovery

## Learning Objectives

- ☑ Understand the LAST model for complaint resolution
- ☑ Know when to offer refund, replacement, or coupon
- ☑ De-escalate upset customers without involving management (when possible)
- ☑ Document complaints in the Guest Recovery Log

## Background & Context

Every complaint is an opportunity. Research shows that customers whose complaints are resolved quickly are **70% more likely** to return than customers who never complained at all.

McDonald's uses the **LAST** model:

| Letter | Step | Description |
|--------|------|-------------|
| **L** | Listen | Let the customer speak without interrupting |
| **A** | Apologize | Sincerely apologize for the inconvenience |
| **S** | Solve | Take action to fix the problem |
| **T** | Thank | Thank them for bringing it to your attention |

## Core Skills

### Empathy Phrases
- "I completely understand how frustrating that must be."
- "I'm sorry that happened — let me fix this for you right away."
- "Thank you for letting us know. That's not the experience we want for you."

### Common Scenarios & Resolutions

| Complaint | Crew Authority | Manager Authority |
|-----------|---------------|-------------------|
| Wrong item in bag | Replace immediately | — |
| Cold food | Replace + apologize | Coupon for next visit |
| Long wait (> 10 min) | Apologize, offer drink | Meal comped or coupon |
| Rude crew member | Apologize sincerely | Pull crew member aside, document |
| Foreign object in food | **Stop — get manager** | Replace, document, file incident report |
| Injury on premises | **Stop — get manager** | First aid, incident report, call district |

### Recovery Toolkit (At Presenter Authority)
- **Free item:** Drink, cookie, or apple pie (≤ $2 value) — no manager approval needed
- **Replacement:** Any incorrect item can be remade immediately
- **Coupon card:** Shift manager can issue "Be Our Guest" card for free combo meal

## Assessment Questions

- ☑ What does LAST stand for?
- ☑ When should you immediately get a manager?
- ☑ Can a crew member issue a coupon without manager approval?
- ☑ What should you document after every complaint?
`,
        },
        {
            title: 'Seasonal Menu Launch — McRib Procedures',
            slug: 'seasonal-menu-mcrib-procedures',
            status: 'draft',
            authorId: member.id,
            templateId: sopTemplate.id,
            tags: ['seasonal', 'mcrib', 'menu', 'limited-time'],
            content: `# Seasonal Menu Launch — McRib Procedures

## Purpose & Scope

The McRib is a limited-time offering (LTO) returning in Q1 2026. This SOP covers preparation, holding, and promotional standards for all franchise locations.

## Equipment Required

- ☑ Dedicated steamer tray for McRib patties
- ☑ McRib sauce dispenser (calibrated to 0.5 oz per sandwich)
- ☑ Onion ring slicer
- ☑ Pickle hopper
- ☑ 6" sesame hoagie-style buns

## Step-by-Step Procedure

### 1. Preparation
1. McRib patties arrive frozen in cases of 40.
2. Place frozen patties in steamer tray — **do not thaw** at room temperature.
3. Steam for **45 seconds** in CLT (Covered Lean Time steamer).
4. Apply **0.5 oz BBQ sauce** using calibrated dispenser.

### 2. Build Order
- Bottom bun (toasted 25 sec)
- McRib patty with sauce
- 3 pickle slices (dill, crinkle-cut)
- Generous onion ring layer (slivered, not diced)
- Top bun

### 3. Holding
- McRib patties in UHC: **20 minutes max** (longer than beef due to sauce)
- Discard after timer. No exceptions for LTO items.

## Promotional Standards

- Display window cling and menu board insert on launch day
- Crew shirts: McRib promotional tees available in break room
- Suggestive sell: "Would you like to try the McRib while it's back?"
`,
        },
        {
            title: 'New Crew Member Onboarding Checklist',
            slug: 'new-crew-member-onboarding',
            status: 'archived',
            authorId: admin.id,
            templateId: trainingTemplate.id,
            tags: ['onboarding', 'training', 'crew', 'hr'],
            content: `# New Crew Member Onboarding Checklist

## Learning Objectives

- ☑ Complete all first-day paperwork and orientation
- ☑ Pass food safety basics quiz within first week  
- ☑ Master one station within 2 weeks
- ☑ Work independently on trained stations within 30 days

## Day 1 — Orientation (4 hours)

1. ☑ Welcome from shift manager, tour of restaurant
2. ☑ Complete W-4, I-9, direct deposit forms
3. ☑ Receive uniform: 2 shirts, 1 hat, name tag, non-slip shoe voucher
4. ☑ Watch safety videos (30 min): fire, slip/fall, lifting, allergens
5. ☑ Review crew handbook — sign acknowledgment
6. ☑ Set up POS login and time-clock access
7. ☑ Shadow an experienced crew member for remainder of shift

## Week 1 — Station Training

- Assigned primary station: _______________
- Complete station-specific modules in the Learning Zone tablet
- Pass food safety basics quiz (score ≥ 80%)
- Practice with buddy during non-peak hours

## Week 2–4 — Building Speed

- Work primary station during peak with buddy support
- Begin cross-training on secondary station
- First performance check-in with shift manager (Day 14)

## 30-Day Review

Shift manager evaluates:
- Attendance and punctuality
- Speed and accuracy at trained stations
- Teamwork and communication
- Food safety compliance

**Pass = probation complete.** Fail = extend training 2 weeks with improvement plan.
`,
        },
    ];

    let articleCount = 0;
    for (const data of articleData) {
        const existing = await prisma.article.findUnique({ where: { slug: data.slug } });
        if (existing) continue;

        const article = await prisma.article.create({ data } as any);

        // Create initial version
        await prisma.articleVersion.create({
            data: {
                articleId: article.id,
                version: 1,
                content: data.content,
                changeSummary: 'Initial creation',
                authorId: data.authorId,
            },
        });

        articleCount++;
    }
    console.log(`  ✓ ${articleCount} knowledge articles (McDonald's franchise)`);

    // ─── Training Modules ───
    const trainingModuleData = [
        {
            title: 'New Crew Orientation',
            description: 'Complete onboarding program for new McDonald\'s crew members. Covers safety, hygiene, POS, and first-station training.',
            difficulty: 'beginner',
            durationMinutes: 240,
            isPublished: true,
            modules: [
                { title: 'Welcome & Restaurant Tour', type: 'lesson', durationMinutes: 30, content: 'Meet the team, tour front counter, drive-thru, kitchen, storage, break room, and safety exits.' },
                { title: 'Food Safety Basics', type: 'lesson', durationMinutes: 45, content: 'Temperature danger zone, hand washing, glove use, allergen awareness, HACCP overview.' },
                { title: 'POS System Training', type: 'exercise', durationMinutes: 30, content: 'Practice taking orders on the training POS terminal. Learn meal combos, modifications, and payment processing.' },
                { title: 'Kitchen Station Overview', type: 'lesson', durationMinutes: 45, content: 'Walkthrough of grill, fry, assembly, and beverage stations. Watch experienced crew at each station.' },
                { title: 'Food Safety Quiz', type: 'quiz', durationMinutes: 20, content: 'Multiple choice quiz covering temperature control, hand hygiene, allergen handling, and HACCP principles. Pass score: 80%.' },
                { title: 'First Station Practice', type: 'exercise', durationMinutes: 60, content: 'Hands-on practice at your assigned primary station during a non-peak period with a buddy.' },
                { title: 'Day 1 Assessment', type: 'assessment', durationMinutes: 10, content: 'Shift manager evaluates comfort level, asks for questions, and sets goals for week 1.' },
            ],
        },
        {
            title: 'Food Safety Certification Prep',
            description: 'Comprehensive food safety training aligned with ServSafe certification. Required for all crew within 90 days.',
            difficulty: 'intermediate',
            durationMinutes: 180,
            isPublished: true,
            modules: [
                { title: 'Foodborne Illness Prevention', type: 'lesson', durationMinutes: 30, content: 'Common pathogens: Salmonella, E. coli, Norovirus, Listeria. Transmission vectors and prevention.' },
                { title: 'Temperature Control Deep Dive', type: 'lesson', durationMinutes: 25, content: 'Cooking temps, holding temps, cooling procedures (135°F → 70°F in 2 hrs, 70°F → 41°F in 4 hrs).' },
                { title: 'Cross-Contamination Prevention', type: 'lesson', durationMinutes: 20, content: 'Color-coded cutting boards, separate storage shelves, allergen isolation, clean-in-place procedures.' },
                { title: 'Cleaning & Sanitizing', type: 'lesson', durationMinutes: 25, content: 'Wash-rinse-sanitize 3-compartment sink, chemical concentrations, contact time requirements.' },
                { title: 'Practical Scenarios', type: 'exercise', durationMinutes: 30, content: 'Walk through 10 realistic scenarios: power outage, employee illness, customer allergy report, delivery temp violation.' },
                { title: 'Practice Exam', type: 'quiz', durationMinutes: 30, content: '40-question practice exam matching ServSafe format. Review answers with trainer.' },
                { title: 'Final Certification Exam', type: 'assessment', durationMinutes: 20, content: 'Official certification exam. 40 questions, pass score: 75%. Results recorded in HR system.' },
            ],
        },
        {
            title: 'Shift Manager Certification',
            description: 'Advanced training for crew members being promoted to shift manager. Covers cash, scheduling, and team leadership.',
            difficulty: 'advanced',
            durationMinutes: 480,
            isPublished: false,
            modules: [
                { title: 'Leadership & Communication', type: 'lesson', durationMinutes: 60, content: 'Crew motivation, giving constructive feedback, handling interpersonal conflicts, leading by example.' },
                { title: 'Cash Handling & Registers', type: 'lesson', durationMinutes: 45, content: 'Z-reports, drawer counting, over/short procedures, deposit preparation, safe operation.' },
                { title: 'Labor Scheduling', type: 'lesson', durationMinutes: 45, content: 'Reading the labor model, scheduling to forecast, break compliance, overtime avoidance.' },
                { title: 'Inventory & Food Cost', type: 'lesson', durationMinutes: 40, content: 'Counting inventory, understanding food cost %, waste tracking, ordering procedures.' },
                { title: 'Guest Recovery & Complaints', type: 'exercise', durationMinutes: 45, content: 'Role-play: handle a wrong order, a rude complaint, a food quality issue, and a potential injury report.' },
                { title: 'Opening Procedures', type: 'lesson', durationMinutes: 30, content: 'Pre-open checklist, equipment startup sequence, first delivery receiving, crew deployment plan.' },
                { title: 'Closing Procedures', type: 'lesson', durationMinutes: 30, content: 'Station shutdown, security checklist, final food waste log, deposit, alarm, lockup.' },
                { title: 'Emergency Scenarios', type: 'exercise', durationMinutes: 45, content: 'Respond to: fire alarm, robbery, employee injury, power outage, plumbing failure.' },
                { title: 'Cash Handling Practical', type: 'quiz', durationMinutes: 30, content: 'Practice counting a drawer, preparing a deposit, and reconciling a Z-report with discrepancies.' },
                { title: 'Shift Manager Certification Exam', type: 'assessment', durationMinutes: 30, content: 'Comprehensive written and practical exam. Graded by general manager. Must score ≥ 85%.' },
            ],
        },
    ];

    let trainingCount = 0;
    const createdTrainings: string[] = [];
    for (const data of trainingModuleData) {
        const existing = await prisma.trainingModule.findFirst({ where: { title: data.title } });
        if (existing) {
            createdTrainings.push(existing.id);
            continue;
        }
        const mod = await prisma.trainingModule.create({ data });
        createdTrainings.push(mod.id);
        trainingCount++;
    }
    console.log(`  ✓ ${trainingCount} training modules`);

    // ─── Learner Progress ───
    const progressData = [
        { userId: member.id, trainingId: createdTrainings[0]!, completionPct: 85, completedItems: ['0', '1', '2', '3', '4', '5'] },
        { userId: guest.id, trainingId: createdTrainings[0]!, completionPct: 42, completedItems: ['0', '1', '2'] },
        { userId: member.id, trainingId: createdTrainings[1]!, completionPct: 100, completedItems: ['0', '1', '2', '3', '4', '5', '6'], completedAt: new Date('2026-02-10') },
        { userId: developer.id, trainingId: createdTrainings[1]!, completionPct: 28, completedItems: ['0', '1'] },
    ];

    let progressCount = 0;
    for (const data of progressData) {
        await prisma.learnerProgress.upsert({
            where: { userId_trainingId: { userId: data.userId, trainingId: data.trainingId } },
            update: { completionPct: data.completionPct, completedItems: data.completedItems as any },
            create: {
                ...data,
                completedItems: data.completedItems as any,
                completedAt: (data as any).completedAt ?? null,
            },
        });
        progressCount++;
    }
    console.log(`  ✓ ${progressCount} learner progress entries`);

    // ─── Document Uploads (Blob records) ───
    const blobData = [
        { filename: 'McDonalds-Franchise-Operations-Manual-2026.pdf', mimeType: 'application/pdf', sizeBytes: 4_820_000, storagePath: '/uploads/manuals/franchise-ops-manual-2026.pdf', uploaderId: admin.id, metadata: { category: 'manual', version: '2026.1', pages: 342 } },
        { filename: 'Daily-Food-Safety-Checklist.pdf', mimeType: 'application/pdf', sizeBytes: 185_000, storagePath: '/uploads/checklists/daily-food-safety-checklist.pdf', uploaderId: admin.id, metadata: { category: 'checklist', type: 'daily', stations: ['grill', 'fry', 'beverage', 'prep'] } },
        { filename: 'Crew-Handbook-Q1-2026.pdf', mimeType: 'application/pdf', sizeBytes: 1_240_000, storagePath: '/uploads/handbooks/crew-handbook-q1-2026.pdf', uploaderId: developer.id, metadata: { category: 'handbook', quarter: 'Q1-2026', pages: 48 } },
        { filename: 'Drive-Thru-Timer-Calibration-Guide.pdf', mimeType: 'application/pdf', sizeBytes: 520_000, storagePath: '/uploads/equipment/dt-timer-calibration.pdf', uploaderId: admin.id, metadata: { category: 'equipment', equipment: 'HME ZOOM Timer' } },
        { filename: 'McRib-Promotional-Assets.zip', mimeType: 'application/zip', sizeBytes: 15_600_000, storagePath: '/uploads/marketing/mcrib-promo-assets.zip', uploaderId: member.id, metadata: { category: 'marketing', campaign: 'McRib-2026', contains: ['window-clings', 'menu-inserts', 'crew-tees'] } },
        { filename: 'Monthly-Inventory-Count-Sheet.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeBytes: 89_000, storagePath: '/uploads/inventory/monthly-count-sheet.xlsx', uploaderId: developer.id, metadata: { category: 'inventory', frequency: 'monthly' } },
        { filename: 'Fryer-Maintenance-Log-Template.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeBytes: 42_000, storagePath: '/uploads/equipment/fryer-maintenance-log.xlsx', uploaderId: admin.id, metadata: { category: 'maintenance', equipment: 'Henny Penny LOV' } },
        { filename: 'ServSafe-Study-Guide.pdf', mimeType: 'application/pdf', sizeBytes: 2_100_000, storagePath: '/uploads/training/servsafe-study-guide.pdf', uploaderId: admin.id, metadata: { category: 'training', certification: 'ServSafe', year: 2026 } },
        { filename: 'Emergency-Procedures-Poster.pdf', mimeType: 'application/pdf', sizeBytes: 3_400_000, storagePath: '/uploads/safety/emergency-procedures-poster.pdf', uploaderId: admin.id, metadata: { category: 'safety', format: 'poster', printSize: '24x36in' } },
        { filename: 'Shift-Manager-Cash-Reconciliation-Form.pdf', mimeType: 'application/pdf', sizeBytes: 67_000, storagePath: '/uploads/forms/cash-reconciliation-form.pdf', uploaderId: developer.id, metadata: { category: 'forms', type: 'financial', fillable: true } },
    ];

    let blobCount = 0;
    for (const data of blobData) {
        const existing = await prisma.blob.findFirst({ where: { filename: data.filename } });
        if (existing) continue;
        await prisma.blob.create({ data: { ...data, tenantId: demoTenant.id } });
        blobCount++;
    }
    console.log(`  ✓ ${blobCount} document uploads (franchise files)`);

    // ─── Jobs (async processing tasks) ───
    type JobSeed = { type: string; status: string; progress: number; userId: string; tenantId: string; result?: object | null; error?: string };
    const jobData: JobSeed[] = [
        { type: 'export_tenant', status: 'completed', progress: 100, userId: admin.id, tenantId: demoTenant.id, result: { exportUrl: '/exports/demo-burger-2026-01-15.zip', rowCount: 1240 } },
        { type: 'import_tenant', status: 'completed', progress: 100, userId: admin.id, tenantId: demoTenant.id, result: { importedTables: 12, rowCount: 856 } },
        { type: 'export_tenant', status: 'failed', progress: 45, userId: developer.id, tenantId: demoTenant.id, error: 'Connection timeout after 30s — storage service unreachable' },
        { type: 'copy_tenant', status: 'running', progress: 67, userId: admin.id, tenantId: demoTenant.id, result: null },
        { type: 'export_tenant', status: 'pending', progress: 0, userId: member.id, tenantId: demoTenant.id, result: null },
        { type: 'import_tenant', status: 'completed', progress: 100, userId: admin.id, tenantId: demoTenant.id, result: { importedTables: 8, rowCount: 203 } },
    ];

    let jobCount = 0;
    for (const data of jobData) {
        const existingJob = await prisma.job.findFirst({ where: { type: data.type, status: data.status, userId: data.userId, tenantId: data.tenantId } });
        if (existingJob) continue;
        await prisma.job.create({ data });
        jobCount++;
    }
    console.log(`  ✓ ${jobCount} async jobs`);

    // ─── AI Conversations & Messages ───
    const conversationSeeds = [
        {
            userId: admin.id,
            tenantId: demoTenant.id,
            title: 'Grill station checklist review',
            model: 'gpt-4o',
            messages: [
                { role: 'user', content: 'Can you summarize the key steps for the grill station SOP?', tokenCount: 18 },
                { role: 'assistant', content: 'Sure! The grill station SOP covers pre-shift setup (preheat to 400°F), cooking regular patties (38 seconds), Quarter Pounders (65 seconds, fresh to order), and bun toasting. Key safety points: internal temp must reach 160°F, change gloves every 30 min, and discard UHC items after 15 minutes.', tokenCount: 68 },
                { role: 'user', content: 'What temperature for Quarter Pounder patties?', tokenCount: 9 },
                { role: 'assistant', content: 'Quarter Pounder patties are cooked at 350°F (177°C) for 65 seconds. They must always be cooked fresh to order — never pre-staged in the UHC.', tokenCount: 34 },
            ],
        },
        {
            userId: developer.id,
            tenantId: demoTenant.id,
            title: 'Food safety HACCP questions',
            model: 'gpt-4o',
            messages: [
                { role: 'user', content: 'What is the bacterial danger zone temperature range?', tokenCount: 12 },
                { role: 'assistant', content: 'The bacterial danger zone is 41°F – 135°F (5°C – 57°C). Food must not remain in this range for more than 4 cumulative hours.', tokenCount: 35 },
                { role: 'user', content: 'How long can prepped lettuce stay out?', tokenCount: 9 },
                { role: 'assistant', content: 'Prepped lettuce and tomato have a 4-hour maximum hold time after cutting. After that, it must be discarded to comply with HACCP standards.', tokenCount: 30 },
                { role: 'user', content: 'What about fried products like fries?', tokenCount: 9 },
                { role: 'assistant', content: 'Fried products such as fries, nuggets, and fish have a maximum hold time of 7 minutes under the heat lamp before they must be discarded.', tokenCount: 30 },
            ],
        },
        {
            userId: member.id,
            tenantId: demoTenant.id,
            title: 'Drive-thru timing targets',
            model: 'gpt-4o',
            messages: [
                { role: 'user', content: 'What is the OEPE target for drive-thru?', tokenCount: 11 },
                { role: 'assistant', content: 'OEPE (Order-End to Present-End) target is ≤ 90 seconds, measured from order confirmation to food presented at the window.', tokenCount: 28 },
            ],
        },
        {
            userId: admin.id,
            tenantId: demoTenant.id,
            title: 'McRib preparation procedure',
            model: 'gpt-4o',
            messages: [
                { role: 'user', content: 'Walk me through the McRib build order', tokenCount: 10 },
                { role: 'assistant', content: 'The McRib build order is: (1) Bottom bun toasted 25 seconds, (2) McRib patty with 0.5 oz BBQ sauce, (3) 3 dill pickle slices, (4) slivered onion layer, (5) Top bun. Patties are steamed for 45 seconds and should be discarded after 20 minutes in the UHC.', tokenCount: 61 },
            ],
        },
        {
            userId: guest.id,
            tenantId: demoTenant.id,
            title: 'New crew onboarding questions',
            model: 'gpt-4o',
            messages: [
                { role: 'user', content: 'What happens on day 1 of onboarding?', tokenCount: 10 },
                { role: 'assistant', content: 'Day 1 onboarding (4 hours): welcome and restaurant tour, complete W-4/I-9/direct deposit forms, receive uniform, watch safety videos (fire, slip/fall, lifting, allergens), review crew handbook, set up POS login and time-clock access, and shadow an experienced crew member.', tokenCount: 52 },
            ],
        },
    ];

    let convCount = 0;
    let msgCount = 0;
    for (const convData of conversationSeeds) {
        const existing = await prisma.aiConversation.findFirst({ where: { title: convData.title, userId: convData.userId } });
        if (existing) continue;
        const conv = await prisma.aiConversation.create({
            data: {
                userId: convData.userId,
                tenantId: convData.tenantId,
                title: convData.title,
                model: convData.model,
            },
        });
        for (const msg of convData.messages) {
            await prisma.aiMessage.create({
                data: {
                    conversationId: conv.id,
                    role: msg.role,
                    content: msg.content,
                    model: convData.model,
                    tokenCount: msg.tokenCount,
                },
            });
            msgCount++;
        }
        convCount++;
    }
    console.log(`  ✓ ${convCount} AI conversations, ${msgCount} messages`);

    // ─── AI Usage Logs ───
    const now = new Date();
    const ONE_HOUR_MS = 3_600_000;
    const usageLogs = [
        { userId: admin.id, tenantId: demoTenant.id, model: 'gpt-4o', provider: 'azure', inputTokens: 18, outputTokens: 68, totalTokens: 86, costUsd: 0.00086, operation: 'chat' },
        { userId: admin.id, tenantId: demoTenant.id, model: 'gpt-4o', provider: 'azure', inputTokens: 9, outputTokens: 34, totalTokens: 43, costUsd: 0.00043, operation: 'chat' },
        { userId: developer.id, tenantId: demoTenant.id, model: 'gpt-4o', provider: 'azure', inputTokens: 12, outputTokens: 35, totalTokens: 47, costUsd: 0.00047, operation: 'chat' },
        { userId: developer.id, tenantId: demoTenant.id, model: 'gpt-4o', provider: 'azure', inputTokens: 9, outputTokens: 30, totalTokens: 39, costUsd: 0.00039, operation: 'chat' },
        { userId: developer.id, tenantId: demoTenant.id, model: 'gpt-4o', provider: 'azure', inputTokens: 9, outputTokens: 30, totalTokens: 39, costUsd: 0.00039, operation: 'chat' },
        { userId: member.id, tenantId: demoTenant.id, model: 'gpt-4o', provider: 'azure', inputTokens: 11, outputTokens: 28, totalTokens: 39, costUsd: 0.00039, operation: 'chat' },
        { userId: admin.id, tenantId: demoTenant.id, model: 'gpt-4o', provider: 'azure', inputTokens: 10, outputTokens: 61, totalTokens: 71, costUsd: 0.00071, operation: 'chat' },
        { userId: guest.id, tenantId: demoTenant.id, model: 'gpt-4o', provider: 'azure', inputTokens: 10, outputTokens: 52, totalTokens: 62, costUsd: 0.00062, operation: 'chat' },
        { userId: admin.id, tenantId: demoTenant.id, model: 'text-embedding-3-large', provider: 'azure', inputTokens: 2048, outputTokens: 0, totalTokens: 2048, costUsd: 0.00013, operation: 'embedding' },
        { userId: admin.id, tenantId: demoTenant.id, model: 'text-embedding-3-large', provider: 'azure', inputTokens: 1536, outputTokens: 0, totalTokens: 1536, costUsd: 0.00010, operation: 'embedding' },
        { userId: developer.id, tenantId: demoTenant.id, model: 'text-embedding-3-large', provider: 'azure', inputTokens: 3072, outputTokens: 0, totalTokens: 3072, costUsd: 0.00020, operation: 'embedding' },
    ];

    const existingUsageLogs = await prisma.aiUsageLog.count();
    if (existingUsageLogs === 0) {
        await prisma.aiUsageLog.createMany({ data: usageLogs.map((l, i) => ({ ...l, createdAt: new Date(now.getTime() - i * ONE_HOUR_MS) })) });
        console.log(`  ✓ ${usageLogs.length} AI usage log entries`);
    } else {
        console.log(`  — AI usage logs already exist (${existingUsageLogs} entries)`);
    }

    // ─── API Request Logs ───
    const FIFTEEN_MINUTES_MS = 900_000;
    const apiPaths = [
        { method: 'GET', path: '/api/platform/health', status: 200, duration: 18 },
        { method: 'GET', path: '/api/platform/database', status: 200, duration: 42 },
        { method: 'GET', path: '/api/articles', status: 200, duration: 23 },
        { method: 'POST', path: '/api/ai/chat', status: 200, duration: 1240 },
        { method: 'GET', path: '/api/articles/grill-station-operating-procedure', status: 200, duration: 9 },
        { method: 'GET', path: '/api/training', status: 200, duration: 15 },
        { method: 'POST', path: '/api/blobs/upload', status: 201, duration: 830 },
        { method: 'GET', path: '/api/platform/streams', status: 200, duration: 55 },
        { method: 'DELETE', path: '/api/articles/seasonal-menu-mcrib-procedures', status: 403, duration: 6 },
        { method: 'GET', path: '/api/settings/tenants', status: 200, duration: 12 },
        { method: 'PUT', path: '/api/settings/tenants/demo-burger', status: 200, duration: 34 },
        { method: 'GET', path: '/api/users/me', status: 200, duration: 7 },
        { method: 'GET', path: '/api/platform/health', status: 200, duration: 21 },
        { method: 'POST', path: '/api/ai/chat', status: 200, duration: 980 },
        { method: 'GET', path: '/api/blobs', status: 200, duration: 28 },
    ];

    const existingRequestLogs = await prisma.apiRequestLog.count();
    if (existingRequestLogs === 0) {
        await prisma.apiRequestLog.createMany({
            data: apiPaths.map((l, i) => ({
                ...l,
                tenantId: demoTenant.id,
                userId: [admin.id, developer.id, member.id, guest.id][i % 4],
                ip: `10.0.1.${(i % 20) + 10}`,
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                createdAt: new Date(now.getTime() - i * FIFTEEN_MINUTES_MS),
            })),
        });
        console.log(`  ✓ ${apiPaths.length} API request log entries`);
    } else {
        console.log(`  — API request logs already exist (${existingRequestLogs} entries)`);
    }

    // ─── Refresh PostgreSQL table statistics ───
    // pg_stat_user_tables.n_live_tup is only updated after ANALYZE runs.
    // Without this, the Database Explorer will show 0 rows for all tables
    // even when data has been seeded.
    await prisma.$executeRaw`ANALYZE`;
    console.log('  ✓ ANALYZE run — table statistics updated for Database Explorer');

    console.log('✅ Seed complete');
}

seed()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
