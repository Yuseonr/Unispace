const http = require('http');

const data = JSON.stringify({
  mode: "DATE_RANGE",
  startDate: "2026-10-04",
  endDate: "2026-10-05",
  note: "makan makan",
  cancellationReason: "makan makan",
  cancelImpactedReservations: true
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/staff/facilities/f47ac10b-58cc-4372-a567-0e02b2c3d479/maintenance',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
