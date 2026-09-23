export type OrganizationMembership={client_id?:string;client_name?:string;display_name?:string;role?:string};

const ACTIVE_ORGANIZATION_KEY="veence-active-organization-id";
const LEGACY_OWNER_KEY="uni-owner-client-id";

function storage(){return typeof window!=="undefined"?window.sessionStorage:null}

export function getActiveOrganizationId(){const s=storage();return s?.getItem(ACTIVE_ORGANIZATION_KEY)||s?.getItem(LEGACY_OWNER_KEY)||null}

export function setActiveOrganizationId(clientId:string){const s=storage();if(!s)return;s.setItem(ACTIVE_ORGANIZATION_KEY,clientId)}

export function clearActiveOrganizationId(){const s=storage();if(!s)return;s.removeItem(ACTIVE_ORGANIZATION_KEY);s.removeItem(LEGACY_OWNER_KEY)}

export function resolveActiveOrganization(memberships:OrganizationMembership[],requestedId?:string|null){if(!memberships.length)return null;if(requestedId&&memberships.some(m=>m.client_id===requestedId))return requestedId;return memberships.length===1?memberships[0]?.client_id||null:null}

export function organizationLabel(m?:OrganizationMembership){return String(m?.display_name||m?.client_name||"Cliente")}
