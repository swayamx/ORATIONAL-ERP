import { app } from './app.js';
import { ENV } from './config/env.js';

const PORT = ENV.PORT;

app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`🚀 Mini Operations ERP Backend Server Running!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`📚 Swagger API Docs: http://localhost:${PORT}/api/docs`);
  console.log(`================================================`);
});

export default app;
