import { devicesStore } from '../server/storage/devicesStore';
import { deviceTokensStore } from '../server/storage/deviceTokensStore';
import { ticketsStore } from '../server/storage/ticketsStore';
import { scanLogsStore } from '../server/storage/scanLogsStore';
import { staffUsersStore } from '../server/storage/staffUsersStore';

// Separate db object just for device authentication functionality
export const deviceAuthDb = {
  devices: devicesStore,
  deviceTokens: deviceTokensStore,
  tickets: ticketsStore,  // This needs to be compatible with the main system
  scanLogs: scanLogsStore,
  staffUsers: staffUsersStore,
};