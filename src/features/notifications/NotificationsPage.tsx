import { AlertCircle, Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMarkNotificationsRead, useNotifications, useUnreadCount } from './api'
import { NotificationItem } from './components/NotificationItem'

export function NotificationsPage() {
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const list = useNotifications({ unreadOnly: tab === 'unread' })
  const unread = useUnreadCount()
  const markRead = useMarkNotificationsRead()

  const mark = (ids?: string[]) =>
    markRead.mutate(ids, { onError: () => toast.error('Could not update notifications. Please try again.') })

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Incoming payments and account activity."
        actions={
          <Button variant="outline" onClick={() => mark()} disabled={!unread.data || markRead.isPending}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread')} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread{unread.data ? ` (${unread.data})` : ''}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent>
          {list.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : list.isError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>We couldn't load your notifications. Please refresh the page.</AlertDescription>
            </Alert>
          ) : list.data.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={tab === 'unread' ? "You're all caught up" : 'No notifications yet'}
              description="You'll be notified here when someone sends you money."
            />
          ) : (
            <ul className="divide-y">
              {list.data.map((n) => (
                <NotificationItem key={n.id} n={n} onMarkRead={(id) => mark([id])} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
