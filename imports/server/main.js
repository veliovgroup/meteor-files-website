import { WebAppInternals } from 'meteor/webapp';

import '/imports/server/files.collection.js';
import '/imports/server/methods.js';
import '/imports/server/publications.js';
import '/imports/server/spiderable.js';
// LOAD 3rd PARTY AUTHENTICATION SETTINGS
import '/imports/server/service-configurations.js';

// LOAD IMAGE PROCESSING HELPER [DEPRECATED IN 2021]
// import '/imports/server/image-processing.js';

WebAppInternals.enableSubresourceIntegrity();
