import { rest } from "msw";
import { baseApiUrl } from "../../../../api/base.js";
import {
  me,
  organizations,
  users,
} from "../../../../api/fixtures/orgAndUser.fixtures.js";

/* Mock Request Handlers */
const mockMeUrl = new URL(`users/me/`, baseApiUrl).toString();
export const mockGetMe = {
  data: rest.get(mockMeUrl, (req, res, ctx) => res(ctx.json(me))),
  noOrgs: rest.get(mockMeUrl, (req, res, ctx) =>
    res(ctx.json({ ...me, organization: "4" })),
  ),
  orgAdmin: rest.get(mockMeUrl, (req, res, ctx) =>
    res(
      ctx.json({
        ...me,
        admin_organizations: [...me.admin_organizations, 1],
      }),
    ),
  ),
  freeOrgMember: rest.get(mockMeUrl, (req, res, ctx) =>
    res(
      ctx.json({ ...me, organization: { ...me.organization, plan: "Free" } }),
    ),
  ),
  freeOrgAdmin: rest.get(mockMeUrl, (req, res, ctx) =>
    res(
      ctx.json({
        ...me,
        organization: { ...me.organization, plan: "Free" },
        admin_organizations: [...me.admin_organizations, 1],
      }),
    ),
  ),
  loading: rest.get(mockMeUrl, (req, res, ctx) => res(ctx.delay("infinite"))),
  error: rest.get(mockMeUrl, (req, res, ctx) =>
    res(ctx.status(404, "Not Found"), ctx.json({ detail: "Not found." })),
  ),
};

/* Mock Request Handlers */
const mockUsersUrl = new URL(`users/`, baseApiUrl).toString();
export const mockInMyOrg = {
  data: rest.get(mockUsersUrl, (req, res, ctx) => res(ctx.json(users))),
  loading: rest.get(mockUsersUrl, (req, res, ctx) =>
    res(ctx.delay("infinite")),
  ),
  error: rest.get(mockUsersUrl, (req, res, ctx) =>
    res(
      ctx.status(400, "Ambiguous Error"),
      ctx.json("Something went horribly wrong."),
    ),
  ),
  empty: rest.get(mockUsersUrl, (req, res, ctx) =>
    res(ctx.json({ next: null, previous: null, results: [] })),
  ),
};

/* Mock Request Handlers */
const mockGetOrgsUrl = new URL(`organizations/`, baseApiUrl).toString();
export const mockGetOrgsList = {
  data: rest.get(mockGetOrgsUrl, (req, res, ctx) =>
    res(ctx.json(organizations)),
  ),
  loading: rest.get(mockGetOrgsUrl, (req, res, ctx) =>
    res(ctx.delay("infinite")),
  ),
  error: rest.get(mockGetOrgsUrl, (req, res, ctx) =>
    res(
      ctx.status(400, "Ambiguous Error"),
      ctx.json("Something went horribly wrong."),
    ),
  ),
  empty: rest.get(mockGetOrgsUrl, (req, res, ctx) =>
    res(
      ctx.json({
        next: null,
        previous: null,
        results: [organizations.results[1]],
      }),
    ),
  ),
};

const mockGetOrgUrl = new URL(`organizations/:id/*`, baseApiUrl).toString();
export const mockGetOrg = {
  data: rest.get(mockGetOrgUrl, (req, res, ctx) =>
    res(
      ctx.json(
        organizations.results.find(({ id }) => id.toString() === req.params.id),
      ),
    ),
  ),
  loading: rest.get(mockGetOrgUrl, (req, res, ctx) =>
    res(ctx.delay("infinite")),
  ),
  error: rest.get(mockGetOrgUrl, (req, res, ctx) =>
    res(
      ctx.status(400, "Ambiguous Error"),
      ctx.json("Something went horribly wrong."),
    ),
  ),
  empty: rest.get(mockGetOrgUrl, (req, res, ctx) =>
    res(ctx.json({ next: null, previous: null, results: [] })),
  ),
  free: rest.get(mockGetOrgUrl, (req, res, ctx) =>
    res(
      ctx.json({
        ...organizations.results.find(
          ({ id }) => id.toString() === req.params.id,
        ),
        plan: "Free",
      }),
    ),
  ),
};

const mockChangeOrgUrl = new URL(`users/me/`, baseApiUrl).toString();
export const mockChangeOrg = rest.patch(mockChangeOrgUrl, (req, res, ctx) =>
  res(ctx.json(me)),
);
