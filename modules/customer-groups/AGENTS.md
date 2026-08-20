# Customer Groups Module

Customer segmentation with manual/automatic groups, rule-based membership, and group-specific price adjustments. Enables B2B wholesale, VIP tiers, and targeted pricing.

## Structure

```
src/
  index.ts          Factory: customerGroups(options?) => Module + admin nav
  schema.ts         Models: customerGroup, groupMembership, groupRule, groupPriceAdjustment
  service.ts        CustomerGroupController interface + types
  service-impl.ts   Controller implementation
  store/endpoints/
    my-groups.ts          GET  /customer-groups/mine (session-based auth)
    my-pricing.ts         GET  /customer-groups/pricing (session-based auth)
    check-membership.ts   GET  /customer-groups/check?groupSlug= (session-based auth)
  admin/endpoints/
    list-groups.ts        GET  /admin/customer-groups
    create-group.ts       POST /admin/customer-groups/create
    get-group.ts          GET  /admin/customer-groups/:id
    update-group.ts       POST /admin/customer-groups/:id/update
    delete-group.ts       POST /admin/customer-groups/:id/delete
    add-member.ts         POST /admin/customer-groups/:id/members/add
    remove-member.ts      POST /admin/customer-groups/:id/members/remove
    list-members.ts       GET  /admin/customer-groups/:id/members
    add-rule.ts           POST /admin/customer-groups/:id/rules/add
    remove-rule.ts        POST /admin/customer-groups/rules/:ruleId/remove
    evaluate-rules.ts     POST /admin/customer-groups/evaluate
    set-pricing.ts        POST /admin/customer-groups/:id/pricing
    list-pricing.ts       GET  /admin/customer-groups/:id/pricing/list
    remove-pricing.ts     POST /admin/customer-groups/pricing/:adjustmentId/remove
    stats.ts              GET  /admin/customer-groups/stats
    bulk-add-members.ts   POST /admin/customer-groups/:id/members/bulk-add (max 500)
    bulk-remove-members.ts POST /admin/customer-groups/:id/members/bulk-remove (max 500)
  admin/components/       Admin UI (placeholder)
```

## Options

```ts
CustomerGroupsOptions {
  defaultGroupSlug?: string   // auto-assign new customers to this group
  includeExpiredMemberships?: boolean  // include expired in lookups, default false
}
```

## Data models

- **customerGroup**: id, name, slug (unique), description, type (manual|automatic), isActive, priority, metadata, timestamps
- **groupMembership**: id, groupId (FK cascade), customerId, joinedAt, expiresAt, metadata
- **groupRule**: id, groupId (FK cascade), field, operator, value, createdAt
- **groupPriceAdjustment**: id, groupId (FK cascade), adjustmentType (percentage|fixed), value, scope (all|category|product), scopeId, timestamps

## Patterns

- Two group types: `manual` (explicit membership) and `automatic` (rule-based matching)
- Rules use AND logic — all rules must match for automatic group assignment
- Rule operators: equals, not_equals, contains, not_contains, greater_than, less_than, in, not_in
- `in` / `not_in` values are comma-separated strings
- Memberships can have an `expiresAt` — expired memberships are excluded by default
- `setPriceAdjustment` upserts: same scope + scopeId replaces existing adjustment
- `deleteGroup` cascades: removes all memberships, rules, and price adjustments
- Groups sorted by `priority` (ascending) in list queries
- Duplicate membership prevention: adding same customer to same group throws
- Store endpoints derive `customerId` from session — never from request params (security)
- Bulk operations: `bulkAddMembers` skips existing members, `bulkRemoveMembers` counts actually removed
- Bulk admin endpoints capped at 500 entries per request
