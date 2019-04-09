import { mapFieldsToModel } from './lib/utils'
import { r, Organization } from '../models'
import { accessRequired } from './errors'
import { buildCampaignQuery, getCampaigns } from './campaign'
import { buildUserOrganizationQuery } from './user'
import { currentAssignmentTarget, countLeft } from './assignment'

import { TextRequestType } from '../../api/organization'

export const resolvers = {
  Organization: {
    ...mapFieldsToModel([
      'id',
      'name'
    ], Organization),
    campaigns: async (organization, { cursor, campaignsFilter }, { user }) => {
      await accessRequired(user, organization.id, 'SUPERVOLUNTEER')
      return getCampaigns(organization.id, cursor, campaignsFilter)
    },
    uuid: async (organization, _, { user }) => {
      await accessRequired(user, organization.id, 'SUPERVOLUNTEER')
      const result = await r.knex('organization')
        .column('uuid')
        .where('id', organization.id)
      return result[0].uuid
    },
    optOuts: async (organization, _, { user }) => {
      await accessRequired(user, organization.id, 'ADMIN')
      return r.table('opt_out')
        .getAll(organization.id, { index: 'organization_id' })
    },
    people: async (organization, { role, campaignId, offset }, { user }) => {
      await accessRequired(user, organization.id, 'SUPERVOLUNTEER')
      const query = buildUserOrganizationQuery(
        r.knex.select('user.*'), organization.id, role, campaignId, offset)
        .orderBy(['first_name', 'last_name', 'id'])
      if (typeof offset === 'number') {
        return query.limit(200)
      }
      return query
    },
    peopleCount: async (organization, _, { user }) => {
      await accessRequired(user, organization.id, 'SUPERVOLUNTEER')
      return r.getCount(r.knex('user')
                        .join('user_organization', 'user.id', 'user_organization.user_id')
                        .where('user_organization.organization_id', organization.id))
    },
    threeClickEnabled: (organization) => organization.features.indexOf('threeClick') !== -1,
    textingHoursEnforced: (organization) => organization.texting_hours_enforced,
    optOutMessage: (organization) => (organization.features && organization.features.indexOf('opt_out_message') !== -1 ? JSON.parse(organization.features).opt_out_message : process.env.OPT_OUT_MESSAGE) || 'I\'m opting you out of texts immediately. Have a great day.',
    textingHoursStart: (organization) => organization.texting_hours_start,
    textingHoursEnd: (organization) => organization.texting_hours_end,
    textRequestFormEnabled: (organization) => {
      try {
        const features = JSON.parse(organization.features)
        return features.textRequestFormEnabled || false;
      } catch (ex) {
        return false
      }
    },
    textRequestType: (organization) => {
      const defaultValue = TextRequestType.UNSENT
      try {
        const features = JSON.parse(organization.features)
        return features.textRequestType || defaultValue
      } catch (ex) {
        return defaultValue
      }
    },
    textRequestMaxCount: (organization) => {
      try {
        const features = JSON.parse(organization.features)
        return parseInt(features.textRequestMaxCount);
      } catch (ex) {
        return null
      }
    },
    textsAvailable: async (organization) => {
      const assignmentTarget = await currentAssignmentTarget(organization.id)
      return !!assignmentTarget
    },
    currentAssignmentTarget: async (organization) => {
      const cat = await currentAssignmentTarget(organization.id)

      if (cat) {
        const cl = await countLeft(cat.type, cat.campaign.id)
        return Object.assign({}, cat, { countLeft: cl })
      } else {
        return cat
      }
    },
    escalationUserId: async (organization) => {
      try {
        const features = JSON.parse(organization.features)
        return parseInt(features.escalationUserId);
      } catch (ex) {
        return null
      }
    }
  }
}
