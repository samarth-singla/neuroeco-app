import { config } from './config';
import { createApp } from './app';

const app = createApp({ clientDist: config.clientDist });

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
