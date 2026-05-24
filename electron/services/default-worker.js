const { parentPort, workerData } = require('worker_threads');

// Default simple worker logic
async function run() {
  const { taskId, name, payload } = workerData;
  
  parentPort.postMessage({ type: 'progress', data: 'Started...' });
  
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  parentPort.postMessage({ type: 'progress', data: 'Processing...' });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  parentPort.postMessage({ type: 'done', data: `Task ${name} completed successfully with payload: ${JSON.stringify(payload)}` });
}

run().catch(err => {
  throw err;
});
