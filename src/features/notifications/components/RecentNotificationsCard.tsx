import { Bell } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotifications } from '../api'
import { NotificationItem } from './NotificationItem'

export function RecentNotificationsCard() {
  const list = useNotifications({ limit: 4 })
  return (
    <Card data-testid="recent-notifications">
      <CardHeader>
        <CardTitle>Recent notifications</CardTitle>
        <CardAction>
          <Button variant="link" size="sm" asChild>
            <Link to="/notifications">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {list.isPending ? (
          <Skeleton className="h-14" />
        ) : list.isError || list.data.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" />
        ) : (
          <ul className="divide-y">
            {list.data.map((n) => (
              <NotificationItem key={n.id} n={n} compact />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
