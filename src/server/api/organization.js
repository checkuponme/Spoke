import { config } from "../../config";
import { sqlResolvers } from "./lib/utils";
import { infoHasQueryPath } from "./lib/apollo";
import { formatPage } from "./lib/pagination";
import { r } from "../models";
import { accessRequired } from "./errors";
import { buildCampaignQuery, getCampaigns } from "./campaign";
import { buildUserOrganizationQuery } from "./user";
import {
  currentAssignmentTarget,
  allCurrentAssignmentTargets,
  myCurrentAssignmentTarget,
  myCurrentAssignmentTargets,
  countLeft,
  cachedMyCurrentAssignmentTargets
} from "./assignment";
import { memoizer, cacheOpts } from "../memoredis";

import { TextRequestType } from "../../api/organization";

export const getEscalationUserId = async organizationId => {
  let escalationUserId;
  try {
    const organization = await r
      .reader("organization")
      .where({ id: organizationId })
      .first("organization.features");
    const features = JSON.parse(organization.features);
    escalationUserId = parseInt(features.escalationUserId);
  } catch (error) {
    // no-op
  }
  return escalationUserId;
};

export const resolvers = {
  Organization: {
    ...sqlResolvers(["id", "name"]),
    settings: organization => organization,
    campaigns: async (organization, { cursor, campaignsFilter }, { user }) => {
      await accessRequired(user, organization.id, "SUPERVOLUNTEER");
      return getCampaigns(organization.id, cursor, campaignsFilter);
    },
    uuid: async (organization, _, { user }) => {
      await accessRequired(user, organization.id, "SUPERVOLUNTEER");
      const result = await r
        .reader("organization")
        .column("uuid")
        .where("id", organization.id);
      return result[0].uuid;
    },
    optOuts: async (organization, _, { user }) => {
      await accessRequired(user, organization.id, "ADMIN");
      return r.reader("opt_out").where({ organization_id: organization.id });
    },
    memberships: async (
      organization,
      { first, after, filter },
      { user },
      info
    ) => {
      await accessRequired(user, organization.id, "SUPERVOLUNTEER");
      const query = r
        .reader("user_organization")
        .where({ organization_id: organization.id });

      const pagerOptions = {
        first,
        after,
        primaryColumn: "user_organization.id"
      };

      const { nameSearch, campaignId, campaignArchived } = filter || {};

      const userQueryPath = "memberships.edges.node.user";
      const wantsUserInfo = infoHasQueryPath(info, userQueryPath);

      if (!!nameSearch || wantsUserInfo) {
        query.join("user", "user.id", "user_organization.user_id");
      }

      if (!!nameSearch) {
        query.whereRaw("user.first_name || ' ' || user.last_name ilike  ?", [
          `%${nameSearch}%`
        ]);
      }

      if (wantsUserInfo) {
        query.select([
          "user_organization.*",
          "user.id as user_table_id",
          "user.email",
          "user.first_name",
          "user.last_name"
        ]);
        pagerOptions.nodeTransformer = record => {
          const {
            user_table_id,
            email,
            first_name,
            last_name,
            ...node
          } = record;
          return {
            ...node,
            user: {
              id: user_table_id,
              email,
              first_name,
              last_name
            }
          };
        };
      }

      const campaignIdInt = parseInt(campaignId);
      if (!isNaN(campaignIdInt)) {
        query.whereExists(function() {
          this.select(r.knex.raw("1"))
            .from("assignment")
            .whereRaw('"assignment"."user_id" = "user"."id"')
            .where({ campaign_id: campaignIdInt });
        });
      } else if (campaignArchived === true || campaignArchived === false) {
        query.whereExists(function() {
          this.select(r.knex.raw("1"))
            .from("assignment")
            .join("campaign", "campaign.id", "assignment.campaign_id")
            .whereRaw('"assignment"."user_id" = "user"."id"')
            .where({
              is_archived: campaignArchived
            });
        });
      }

      return await formatPage(query, pagerOptions);
    },
    people: async (organization, { role, campaignId, offset }, { user }) => {
      await accessRequired(user, organization.id, "SUPERVOLUNTEER");
      const query = buildUserOrganizationQuery(
        r.knex.select("user.*"),
        organization.id,
        role,
        campaignId,
        offset
      ).orderBy(["first_name", "last_name", "id"]);
      if (typeof offset === "number") {
        return query.limit(200);
      }
      return query;
    },
    peopleCount: async (organization, _, { user }) => {
      await accessRequired(user, organization.id, "SUPERVOLUNTEER");
      return r.getCount(
        r
          .reader("user")
          .join("user_organization", "user.id", "user_organization.user_id")
          .where("user_organization.organization_id", organization.id)
      );
    },
    threeClickEnabled: organization =>
      organization.features.indexOf("threeClick") !== -1,
    textingHoursEnforced: organization => organization.texting_hours_enforced,
    optOutMessage: organization =>
      (organization.features &&
      organization.features.indexOf("opt_out_message") !== -1
        ? JSON.parse(organization.features).opt_out_message
        : config.OPT_OUT_MESSAGE) ||
      "I'm opting you out of texts immediately. Have a great day.",
    textingHoursStart: organization => organization.texting_hours_start,
    textingHoursEnd: organization => organization.texting_hours_end,
    textRequestFormEnabled: organization => {
      try {
        const features = JSON.parse(organization.features);
        return features.textRequestFormEnabled || false;
      } catch (ex) {
        return false;
      }
    },
    textRequestType: organization => {
      const defaultValue = TextRequestType.UNSENT;
      try {
        const features = JSON.parse(organization.features);
        return features.textRequestType || defaultValue;
      } catch (ex) {
        return defaultValue;
      }
    },
    textRequestMaxCount: organization => {
      try {
        const features = JSON.parse(organization.features);
        return parseInt(features.textRequestMaxCount);
      } catch (ex) {
        return null;
      }
    },
    textsAvailable: async (organization, _, context) => {
      const assignmentTarget = await myCurrentAssignmentTarget(
        context.user.id,
        organization.id
      );
      return !!assignmentTarget;
    },
    currentAssignmentTargets: async (organization, _, { user }) => {
      await accessRequired(user, organization.id, "SUPERVOLUNTEER");
      const cats = await allCurrentAssignmentTargets(organization.id);
      const formatted = cats.map(cat => ({
        type: cat.assignment_type,
        countLeft: parseInt(cat.count_left),
        campaign: {
          id: cat.id,
          title: cat.title
        },
        teamTitle: cat.team_title,
        enabled: cat.enabled
      }));
      return formatted;
    },
    myCurrentAssignmentTarget: async (organization, _, context) => {
      const assignmentTarget = await myCurrentAssignmentTarget(
        context.user.id,
        organization.id
      );

      return assignmentTarget
        ? {
            type: assignmentTarget.type,
            countLeft: parseInt(assignmentTarget.count_left),
            maxRequestCount: parseInt(assignmentTarget.max_request_count),
            teamTitle: assignmentTarget.team_title
          }
        : null;
    },
    myCurrentAssignmentTargets: async (organization, _, context) => {
      const assignmentTargets = await cachedMyCurrentAssignmentTargets(
        context.user.id,
        organization.id
      );

      return assignmentTargets.map(at => ({
        type: at.type,
        countLeft: parseInt(at.count_left),
        maxRequestCount: parseInt(at.max_request_count),
        teamTitle: at.team_title,
        teamId: at.team_id
      }));
    },
    escalatedConversationCount: async organization => {
      if (config.DISABLE_SIDEBAR_BADGES) return 0;

      const subQuery = r.reader
        .select("campaign_contact_tag.campaign_contact_id")
        .from("campaign_contact_tag")
        .join("tag", "tag.id", "=", "campaign_contact_tag.tag_id")
        .where({
          "tag.organization_id": organization.id
        })
        .whereRaw("lower(tag.title) = 'escalated'")
        .whereRaw(
          "campaign_contact_tag.campaign_contact_id = campaign_contact.id"
        );

      const countQuery = r
        .reader("campaign_contact")
        .join("assignment", "assignment.id", "campaign_contact.assignment_id")
        .whereExists(subQuery)
        .count("*");

      const escalatedCount = await r.parseCount(countQuery);
      return escalatedCount;
    },
    numbersApiKey: async organization => {
      let numbersApiKey = null;

      try {
        const features = JSON.parse(organization.features);
        numbersApiKey = features.numbersApiKey.slice(0, 4) + "****************";
      } catch (ex) {
        // no-op
      }

      return numbersApiKey;
    },
    pendingAssignmentRequestCount: async organization =>
      config.DISABLE_SIDEBAR_BADGES
        ? 0
        : r.parseCount(
            r
              .reader("assignment_request")
              .count("*")
              .where({
                status: "pending",
                organization_id: organization.id
              })
          ),
    linkDomains: async organization => {
      const rawResult = await r.reader.raw(
        `
        select
          link_domain.*,
          (is_unhealthy is null or not is_unhealthy) as is_healthy
        from
          link_domain
        left join
          (
            select
              domain,
              (healthy_again_at is null or healthy_again_at > now()) as is_unhealthy
            from
              unhealthy_link_domain
            order by
              created_at desc
            limit 1
          ) unhealthy_domains
          on
            unhealthy_domains.domain = link_domain.domain
        where
          link_domain.organization_id = ?
        order by created_at asc
        ;
      `,
        [organization.id]
      );
      return rawResult.rows;
    },
    unhealthyLinkDomains: async _ => {
      const rawResult = await r.knex.raw(`
        select
          distinct on (domain) *
        from
          unhealthy_link_domain
        order by
          domain,
          created_at desc
        ;
      `);
      return rawResult.rows;
    },
    tagList: async organization => {
      const getTags = await memoizer.memoize(async ({ organizationId }) => {
        return await r
          .reader("tag")
          .where({ organization_id: organizationId })
          .orderBy(["is_system", "title"]);
      }, cacheOpts.OrganizationTagList);

      return await getTags({ organizationId: organization.id });
    },
    escalationTagList: async organization => {
      const getEscalationTags = await memoizer.memoize(
        async ({ organizationId }) => {
          return await r
            .reader("tag")
            .where({ organization_id: organization.id, is_assignable: false })
            .orderBy("is_system", "desc")
            .orderBy("title", "asc");
        },
        cacheOpts.OrganizationEscalatedTagList
      );

      return await getEscalationTags({ organizationId: organization.id });
    },
    teams: async organization =>
      r
        .reader("team")
        .where({ organization_id: organization.id })
        .orderBy("assignment_priority", "asc")
  }
};
