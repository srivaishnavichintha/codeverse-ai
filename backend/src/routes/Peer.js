const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
// const { createChallenge } = require('../controllers/Peer/Challenges');
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