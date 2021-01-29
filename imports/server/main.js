import { WebAppInternals } from 'meteor/webapp';

import '/imports/server/files.collection.js';
import '/imports/server/methods.js';
import '/imports/server/spiderable.js';
// service-configuration.js USED TO
// LOAD 3rd PARTY AUTHENTICATION SETTINGS
// import '/imports/service-configuration.js';

// image-processing.js USED TO
// DEFINE IMAGE PROCESSING HELPER
// import '/imports/image-processing.js';

WebAppInternals.enableSubresourceIntegrity();
