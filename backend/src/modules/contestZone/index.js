'use strict';

/**
 * Contest Zone module barrel export.
 * Import from here for cleaner paths.
 */

module.exports = {
  models: {
    ContestZone:        require('./models/ContestZone.model'),
    ContestParticipant: require('./models/ContestParticipant.model'),
    ContestProblem:     require('./models/ContestProblem.model'),
    ContestSubmission:  require('./models/ContestSubmission.model'),
    ContestLeaderboard: require('./models/ContestLeaderboard.model'),
    ContestRewardLog:   require('./models/ContestRewardLog.model'),
  },
  routes:   require('./routes/contestZone.routes'),
  sockets:  require('./sockets/contestZone.socket'),
};
