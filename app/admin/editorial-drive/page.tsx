import {requireAdminPageOrRedirect} from '@/lib/adminAuth';
import EditorialPanel from '@/components/admin/DriveEditorialPanel';
export default async function Page(){await requireAdminPageOrRedirect('/admin/editorial-drive');return <EditorialPanel/>;}
