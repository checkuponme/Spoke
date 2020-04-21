import {r} from "../../models";

export async function maybeOnboardNewContact(contactNumber, userNumber) {
  const campaignId = process.env.CAMPAIGN_ID;
  const isExistingUser = r
    .knex("campaign_contact")
    .select('id')
    .where({
      cell: contactNumber,
      campaign_id: campaignId
    })
    .limit(1)

  if (! isExistingUser || (isExistingUser.length && isExistingUser.length<1)) {
    const onboardingCampaignId = process.env.ONBOARDING_CAMPAIGN || campaignID + 1;
    const contact = {
      first_name: "",
      last_name: "",
      cell: contactNumber,
      campaign_id: onboardingCampaignId
    };
    let contactId = await r
      .knex("campaign_contact")
      .insert(contact)
      .return('id');

    if (contactId) {
      const onboardingText =
        'Hi there! Thanks for sending a text to CheckUpOn.Me! If you would like to be texted by one of our volunteers, please reply to this message with the word "YES".';

      let organizationId = await r
        .knex("campaign")
        .select("organization_id")
        .where({campaign_id: onboardingCampaignId})
        .first();

      const replyMessage = {
        campaign_contact_id: contactId,
        user_number: userNumber,
        text: onboardingText,
        contact_number: contactNumber,
      };
      sendMessage(replyMessage, organizationId)
        .then(data=>console.info(`Onboarding sent to ${contactNumber}`))
        .catch(err=>console.error(`Unable to onboard invite ${contactNumber}: ${err}`));
    }
  }
}
