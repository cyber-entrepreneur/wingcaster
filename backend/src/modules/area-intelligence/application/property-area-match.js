function norm(value) {
  return String(value || '').trim().toLowerCase()
}

/**
 * Whether a listing sits inside an area-intelligence profile.
 *
 * area_profiles store `name` / `slug` / `level`, not city/neighborhood columns.
 * Properties store `city` / `neighborhood` / `location`. Also honour optional
 * `area.city` / `area.neighborhood` when those ride along in the JSONB blob
 * (same matching as platform-adapter.getPropertiesForArea).
 */
export function propertyMatchesArea(property, area) {
  if (!property || !area) return false

  const city = norm(property.city)
  const neighborhood = norm(property.neighborhood)
  const location = norm(property.location)
  const areaName = norm(area.name)
  const areaSlug = norm(area.slug)
  const areaCity = norm(area.city)
  const areaNeighborhood = norm(area.neighborhood)

  if (areaCity && city === areaCity) return true
  if (areaNeighborhood && neighborhood === areaNeighborhood) return true

  if (area.level === 'neighborhood' || area.level === 'village') {
    return Boolean(areaName || areaSlug) && (
      neighborhood === areaName || neighborhood === areaSlug || location === areaName || location === areaSlug
    )
  }
  if (area.level === 'city' || area.level === 'territory') {
    return Boolean(areaName || areaSlug) && (
      city === areaName || city === areaSlug || location === areaName || location === areaSlug
    )
  }
  return Boolean(
    (areaName && (city === areaName || neighborhood === areaName || location === areaName))
    || (areaSlug && (city === areaSlug || neighborhood === areaSlug || location === areaSlug)),
  )
}

/**
 * Inspector must present an assignment whose area covers the property.
 * Platform admins (platform_role admin / platform_admin) skip that check.
 */
export async function authorizeInspectorPropertyRate({
  user,
  assignmentId,
  property,
  inspectorService,
  areaService,
  isPlatformAdmin = false,
}) {
  if (isPlatformAdmin) {
    if (!assignmentId) return { ok: true, assignment: null, area: null }
    const assignment = await inspectorService.getAssignmentById(assignmentId)
    const area = assignment ? await areaService.getById(assignment.area_id) : null
    return { ok: true, assignment: assignment || null, area: area || null }
  }

  if (!assignmentId) {
    return { ok: false, status: 400, error: 'assignment_id is required' }
  }

  const assignment = await inspectorService.getAssignmentById(assignmentId)
  if (!assignment || assignment.agent_id !== user?.id) {
    return { ok: false, status: 403, error: 'Forbidden: assignment not owned by you' }
  }

  const area = await areaService.getById(assignment.area_id)
  if (!area || !propertyMatchesArea(property, area)) {
    return { ok: false, status: 403, error: 'Forbidden: assignment does not cover this property' }
  }

  return { ok: true, assignment, area }
}
