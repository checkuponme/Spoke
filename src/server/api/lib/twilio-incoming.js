import { r } from "../../models";
import { sendMessage } from './twilio';
import { getFormattedPhoneNumber } from "../../../lib/phone-format";
import logger from "../../../logger";
import { config } from "../../../config";


export async function maybeOnboardNewContact(incomingMessage, trx=r.knex) {
  const contactCell = getFormattedPhoneNumber(incomingMessage.From);
  const campaignCell = getFormattedPhoneNumber(incomingMessage.To);
  const messagingServiceSid = incomingMessage.MessagingServiceSid;

  const {ONBOARDING_CAMPAIGN_ID:onboardingCampaignId} = config;
  const onboardingText =
    'Hi there! Thanks for sending a text to CheckUpOn.Me! If you would like to be texted by one of our volunteers, please reply to this message with the word "YES".';

  if (!onboardingCampaignId) {
    logger.error(`ONBOARDING_CAMPAIGN_ID not set in .env. Can not onboard ${contactCell}`);
    return;
  }

  const users = await trx("campaign_contact")
    .select('id')
    .where({
      cell: contactCell,
    })
    .limit(1);
    
  if (!users || !users.length) {
    const [[contactId], {organization_id:organizationId}] = await Promise.all([
      await trx("campaign_contact")
        .insert({
          first_name: "",
          last_name: "",
          cell: contactCell,
          campaign_id: onboardingCampaignId
        })
        .returning('id'),
      await trx("messaging_service")
        .select("organization_id")
        .where({messaging_service_sid: messagingServiceSid})
        .first()
    ]);
    const replyMessage = {
      campaign_contact_id: contactId,
      user_number: campaignCell,
      text: onboardingText,
      contact_number: contactCell,
      service: 'twilio',
	is_from_contact: false,
	assignment_id: -1

    };
//    const messageId = await trx('message').insert(replyMessage).returning('id')
//      saveNewIncomingMessage()  
    sendMessage(replyMessage, organizationId)
      .then(result=>logger.info(`Onboarding sent to ${contactCell}`))
      .catch(err=>logger.error(`Unable to onboard new cell ${contactCell}: ${err}`));
  }
}
/*
1:15:43 PM server.1  |  Unhandled rejection Error: Undefined binding(s) det
1:15:43 PM server.1  |  >  ected when compiling UPDATE query: update "message"
1:15:43 PM server.1  |  >   set "campaign_contact_id" = ?, "user_number" = ?, 
1:15:43 PM server.1  |  >  "text" = ?, "contact_number" = ?, "service" = ?, "s
1:15:43 PM server.1  |  >  ervice_id" = ?, "service_response" = ?, "send_statu
1:15:43 PM server.1  |  >  s" = ?, "sent_at" = CURRENT_TIMESTAMP where "id" = 
1:15:43 PM server.1  |  >  ? returning *
1:15:43 PM server.1  |      at QueryCompiler_PG.toSQL (/opt/Spoke.git/node_
1:15:43 PM server.1  |  >  modules/rethink-knex-adapter/node_modules/knex/lib/
1:15:43 PM server.1  |  >  query/compiler.js:85:13)
1:15:43 PM server.1  |      at Builder.toSQL (/opt/Spoke.git/node_modules/r
1:15:43 PM server.1  |  >  ethink-knex-adapter/node_modules/knex/lib/query/bui
1:15:43 PM server.1  |  >  lder.js:72:44)
1:15:43 PM server.1  |      at /opt/Spoke.git/node_modules/rethink-knex-ada
1:15:43 PM server.1  |  >  pter/node_modules/knex/lib/runner.js:37:34
1:15:43 PM server.1  |      at processImmediate (internal/timers.js:456:21)
1:15:43 PM server.1  |      at process.topLevelDomainCallback (domain.js:13
1:15:43 PM server.1  |  >  7:15)
1:15:43 PM server.1  |  From previous event:
1:15:43 PM server.1  |      at Runner.run (/opt/Spoke.git/node_modules/reth
1:15:43 PM server.1  |  >  ink-knex-adapter/node_modules/knex/lib/runner.js:33
1:15:43 PM server.1  |  >  :30)
1:15:43 PM server.1  |      at Builder.then (/opt/Spoke.git/node_modules/re
1:15:43 PM server.1  |  >  think-knex-adapter/node_modules/knex/lib/interface.
1:15:43 PM server.1  |  >  js:23:43)
1:15:43 PM server.1  |      at /opt/Spoke.git/src/server/api/lib/twilio.js:
1:15:43 PM server.1  |  >  304:12
1:15:43 PM server.1  |      at /opt/Spoke.git/node_modules/twilio/node_modu
1:15:43 PM server.1  |  >  les/q/q.js:1920:17
1:15:43 PM server.1  |      at flush (/opt/Spoke.git/node_modules/twilio/no
1:15:43 PM server.1  |  >  de_modules/q/q.js:108:17)
1:15:43 PM server.1  |      at processTicksAndRejections (internal/process/
1:15:43 PM server.1  |  >  task_queues.js:79:11)
1:15:49 PM server.1  |  {"message":"Received message report 'queued' for Me
1:15:49 PM server.1  |  >  ssage SID 'SM122aea75125949f7a5264090bdb6dfd9' that
1:15:49 PM server.1  |  >   matched 0 messages. Expected only 1 match.","level
1:15:49 PM server.1  |  >  ":"warn","timestamp":"2020-04-26T13:15:49.019Z"}
1:15:49 PM server.1  |  {"message":"Received message report 'sent' for Mess
1:15:49 PM server.1  |  >  age SID 'SM122aea75125949f7a5264090bdb6dfd9' that m
1:15:49 PM server.1  |  >  atched 0 messages. Expected only 1 match.","level":
1:15:49 PM server.1  |  >  "warn","timestamp":"2020-04-26T13:15:49.030Z"}
1:15:49 PM server.1  |  {"message":"Received message report 'delivered' for
1:15:49 PM server.1  |  >   Message SID 'SM122aea75125949f7a5264090bdb6dfd9' t
1:15:49 PM server.1  |  >  hat matched 0 messages. Expected only 1 match.","le
1:15:49 PM server.1  |  >  vel":"warn","timestamp":"2020-04-26T13:15:49.999Z"}



*/


