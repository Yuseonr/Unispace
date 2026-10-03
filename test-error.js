const { PrismaClient } = require('./unispace-backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const facilityId = "f47ac10b-58cc-4372-a567-0e02b2c3d479"; // we can query for one
    const facility = await prisma.facility.findFirst();
    if (!facility) return console.log("No facility");
    
    // Just try to test the maintenance dates manually or look at data
    console.log("Facility:", facility.id);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
