import { useTenantPlanContext } from '../context/TenantPlanContext';

export function useTenantPlan() {
  return useTenantPlanContext();
}

export default useTenantPlan;
