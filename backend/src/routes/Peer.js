const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createChallenge,
  respondToChallenge,
  getIncomingChallenges,
  getOutgoingChallenges,
  cancelChallenge
} = require('../controllers/Peer/Challenges');
const {
  getMyBattles,
  submitBattleCode,
  getBattleStartInfo,
  evaluateBattleController
} = require('../controllers/Peer/Battlecontroller');
const {
  enterQueue,
  getQueueStatus,
  leaveQueue,
} = require('../controllers/Peer/MatchmakeController');


//----Matchmaking Routes-----//
// POST   /api/peers/matchmake         — enter queue (or instant-pair if opponent found)
// GET    /api/peers/matchmake/status  — poll for paired battle
// DELETE /api/peers/matchmake         — cancel and leave queue
router.post(  '/matchmake',        auth.authenticate, enterQueue);
router.get(   '/matchmake/status', auth.authenticate, getQueueStatus);
router.delete('/matchmake',        auth.authenticate, leaveQueue);

//----Challenge Routes-----//
router.post('/challenge', auth.authenticate, createChallenge);       // To Create Challenge
router.post('/:id/respond', auth.authenticate, respondToChallenge);  //When the challenge is Accepted
router.get('/incoming', auth.authenticate, getIncomingChallenges);   //To get all the inviations
router.get('/outgoing', auth.authenticate, getOutgoingChallenges);   //To get all the sent invitations
router.patch('/:id/cancel', auth.authenticate, cancelChallenge);     // To cancel an invitation

//----Battle Routes-----//
router.get('/user/me', auth.authenticate, getMyBattles);   // To get all the loginned user Battles
router.post('/battle/submit', auth.authenticate, submitBattleCode);  //submitting the code in the battle 
router.get('/battle/:battleId/start-info', auth.authenticate, getBattleStartInfo);  //Battle information getting
router.post('/battle/:battleId/evaluate', auth.authenticate, evaluateBattleController);  //Evaluation of codes and finalising the winner
module.exports = router;