import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ConstructionCalendar() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🏗️ Baustellenkalender</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <iframe
          src="https://calendar.google.com/calendar/embed?src=baustellen.nobis%40gmail.com&ctz=Europe%2FBerlin&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0"
          className="w-full h-[700px] border-0 rounded-b-lg"
          frameBorder="0"
          title="Baustellenkalender"
        />
      </CardContent>
    </Card>
  );
}
