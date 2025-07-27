'use client';

import { useState, useEffect, useRef } from 'react';
import { format, startOfWeek, addDays, subDays, set, isToday, parseISO, isBefore, startOfDay, getDay, isAfter, subWeeks, isEqual } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogDesc,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Home, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Reservation {
  name: string;
  obs: string;
}

export default function TherapyPoolScheduler() {
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Record<string, Reservation>>({});
  const [holidays, setHolidays] = useState<string[]>([]);
  const [patientName, setPatientName] = useState('');
  const [observations, setObservations] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirmationSlotId, setDeleteConfirmationSlotId] = useState<string | null>(null);

  const [isMultiSelectActive, setIsMultiSelectActive] = useState(false);
  const [multiSelectSlots, setMultiSelectSlots] = useState<string[]>([]);
  const [multiSelectReservationData, setMultiSelectReservationData] = useState<Reservation | null>(null);

  const [confirmationSlot, setConfirmationSlot] = useState<string | null>(null);

  const [holidayConfirmationDate, setHolidayConfirmationDate] = useState<Date | null>(null);
  
  const longPressTimer = useRef<NodeJS.Timeout>();


  useEffect(() => {
    setCurrentDate(new Date());
    // Load reservations from localStorage on initial render
    try {
      const savedReservations = localStorage.getItem('reservations');
      if (savedReservations) {
        const parsedReservations = JSON.parse(savedReservations);
        const threeWeeksAgo = startOfDay(subWeeks(new Date(), 3));
        const filteredReservations: Record<string, Reservation> = {};
        
        Object.keys(parsedReservations).forEach(slotId => {
          const slotDate = parseISO(slotId.split('T')[0]);
          if (isAfter(slotDate, threeWeeksAgo) || isToday(slotDate)) {
            filteredReservations[slotId] = parsedReservations[slotId];
          }
        });
        setReservations(filteredReservations);
      }
      
      const savedHolidays = localStorage.getItem('holidays');
      if (savedHolidays) {
        setHolidays(JSON.parse(savedHolidays));
      }
    } catch (error) {
        console.error("Failed to parse data from localStorage", error);
    }
  }, []);
  
  // Save reservations to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(reservations).length > 0) {
      localStorage.setItem('reservations', JSON.stringify(reservations));
    } else {
      localStorage.removeItem('reservations');
    }
  }, [reservations]);
  
  useEffect(() => {
    if (holidays.length > 0) {
        localStorage.setItem('holidays', JSON.stringify(holidays));
    } else {
        localStorage.removeItem('holidays');
    }
  }, [holidays]);


  if (!currentDate) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 md:p-12 bg-gray-50">
        <div>Cargando calendario...</div>
      </main>
    );
  }

  const startOfWeekDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // 1 = Lunes

  const days = Array.from({ length: 6 }).map((_, i) => addDays(startOfWeekDate, i));

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = set(new Date(), { hours: hour, minutes: minute });
        slots.push(format(time, 'HH:mm'));
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
  
  const threeWeeksAgoLimit = startOfWeek(subWeeks(new Date(), 3), { weekStartsOn: 1 });
  const canGoToPrevWeek = isAfter(startOfWeekDate, threeWeeksAgoLimit);

  const isDayHoliday = (day: Date) => {
    const dateString = format(day, 'yyyy-MM-dd');
    return holidays.includes(dateString);
  }

  const handlePrevWeek = () => {
    if (canGoToPrevWeek) {
      setCurrentDate(subDays(currentDate, 7));
    }
  };

  const handleNextWeek = () => {
    setCurrentDate(addDays(currentDate, 7));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const isSlotInPast = (slotId: string) => {
    const dayOfSlot = parseISO(slotId.split('T')[0]);
    const timeOfSlot = slotId.split('T')[1];
    const [hour, minute] = timeOfSlot.split(':').map(Number);
    const slotDateTime = set(dayOfSlot, { hours: hour, minutes: minute });

    return isBefore(slotDateTime, new Date());
  };

  const isBlockedSaturdaySlot = (day: Date, time: string) => {
    if (getDay(day) !== 6) return false; // Not a Saturday
    const [hour, minute] = time.split(':').map(Number);
    if (hour > 12 || (hour === 12 && minute >= 15)) {
        return true;
    }
    return false;
  }

  const handleLongPressStart = (day: Date) => {
    if (isBefore(day, startOfDay(new Date()))) {
      return; // Do not allow setting holidays for past dates
    }
    longPressTimer.current = setTimeout(() => {
        setHolidayConfirmationDate(day);
    }, 2000); // 2 seconds
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
    }
  };

  const confirmHolidayToggle = () => {
    if (holidayConfirmationDate) {
        const dateString = format(holidayConfirmationDate, 'yyyy-MM-dd');
        if (isDayHoliday(holidayConfirmationDate)) {
            // Remove holiday
            setHolidays(prev => prev.filter(d => d !== dateString));
        } else {
            // Add holiday
            setHolidays(prev => [...prev, dateString]);
        }
        setHolidayConfirmationDate(null);
    }
  }


  const handleCellClick = (slotId: string, isBlocked: boolean) => {
    if (isBlocked) return;
    
    if (isSlotInPast(slotId)) {
        if (reservations[slotId]) {
            setConfirmationSlot(slotId);
        }
        return; 
    }

    if (isMultiSelectActive) {
      if (reservations[slotId]) return; // Don't select already reserved slots
      setMultiSelectSlots((prev) =>
        prev.includes(slotId) ? prev.filter((s) => s !== slotId) : [...prev, slotId]
      );
      return;
    }

    if (reservations[slotId]) {
      return;
    }
    setIsEditing(false);
    setSelectedSlot(slotId);
    setPatientName('');
    setObservations('');
  };

  const handleEditReservation = (slotId: string) => {
    setIsEditing(true);
    setSelectedSlot(slotId);
    setPatientName(reservations[slotId]?.name || '');
    setObservations(reservations[slotId]?.obs || '');
  };

  const handleDeleteReservation = (e: React.MouseEvent, slotId: string) => {
    e.stopPropagation();
    setDeleteConfirmationSlotId(slotId);
  };

  const confirmDelete = () => {
    if (deleteConfirmationSlotId) {
      const newReservations = { ...reservations };
      delete newReservations[deleteConfirmationSlotId];
      setReservations(newReservations);
      setDeleteConfirmationSlotId(null);
    }
  };

  const handleCloseDialog = () => {
    setSelectedSlot(null);
    setPatientName('');
    setObservations('');
    setIsEditing(false);
  };

  const handleSave = () => {
    if (selectedSlot) {
      setReservations((prev) => ({
        ...prev,
        [selectedSlot]: { name: patientName, obs: observations },
      }));
    }
    handleCloseDialog();
  };

  const handleStartMultiSelect = () => {
    if (!selectedSlot || !patientName) return;
    setIsMultiSelectActive(true);
    setMultiSelectReservationData({ name: patientName, obs: observations });
    setMultiSelectSlots([selectedSlot]);
    handleCloseDialog();
  };

  const handleCancelMultiSelect = () => {
    setIsMultiSelectActive(false);
    setMultiSelectSlots([]);
    setMultiSelectReservationData(null);
  };

  const handleSaveMultiSelect = () => {
    if (!multiSelectReservationData) return;

    const newReservations = { ...reservations };
    multiSelectSlots.forEach((slotId) => {
      newReservations[slotId] = multiSelectReservationData;
    });

    setReservations(newReservations);
    handleCancelMultiSelect();
  };

  const getFormattedSlotDate = (slotId: string | null) => {
    if (slotId) {
      const date = parseISO(slotId.split('T')[0]);
      const time = slotId.split('T')[1];
      return `${format(date, 'eeee, dd/MM/yyyy', { locale: es })} a las ${time}`;
    }
    return '';
  };
  
  const handleAttendance = (status: 'Asistió' | 'No asistió' | 'Llamó') => {
    if (confirmationSlot) {
      setReservations((prev) => ({
        ...prev,
        [confirmationSlot]: {
          ...prev[confirmationSlot],
          obs: status,
        },
      }));
      setConfirmationSlot(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12 bg-gray-50">
      <Card className="w-full max-w-7xl shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          {isMultiSelectActive ? (
            <div className='flex flex-col gap-2'>
              <CardTitle className="text-xl font-bold">Modo de Selección Múltiple</CardTitle>
              <p className='text-sm text-muted-foreground'>
                Seleccione las celdas para aplicar la reserva para <span className='font-bold'>{multiSelectReservationData?.name}</span>.
              </p>
            </div>
          ) : (
            <CardTitle className="text-2xl font-bold">
              Reservaciones para Piscina
            </CardTitle>
          )}

          {isMultiSelectActive ? (
            <div className="flex items-center space-x-2">
              <Button onClick={handleSaveMultiSelect}>Confirmar selección ({multiSelectSlots.length})</Button>
              <Button variant="outline" onClick={handleCancelMultiSelect}>Cancelar</Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={handlePrevWeek} disabled={!canGoToPrevWeek}>
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Semana anterior</span>
              </Button>
              <Button variant="outline" onClick={handleToday}>
                Hoy
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Semana siguiente</span>
              </Button>
              <a
                href="https://www.hidrofisio.com/sistema-hidrofisio2-0/"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'destructive', size: 'icon' }))}
              >
                <Home className="h-4 w-4" />
                <span className="sr-only">Home</span>
              </a>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="border">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24 text-center font-semibold">Hora</TableHead>
                  {days.map((day) => (
                    <TableHead
                      key={day.toISOString()}
                      className={cn(
                        'text-center font-semibold select-none cursor-pointer',
                        isToday(day) && 'bg-primary/20',
                        isDayHoliday(day) && 'bg-gray-300'
                      )}
                      onMouseDown={() => handleLongPressStart(day)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={() => handleLongPressStart(day)}
                      onTouchEnd={handleLongPressEnd}
                    >
                      <div className="capitalize">{format(day, 'eeee', { locale: es })}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(day, 'dd/MM/yyyy')}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeSlots.map((time) => (
                  <TableRow key={time}>
                    <TableCell className="text-center font-medium text-muted-foreground border-r">
                      {time}
                    </TableCell>
                    {days.map((day) => {
                      const slotId = `${format(day, 'yyyy-MM-dd')}T${time}`;
                      const reservation = reservations[slotId];
                      const isMultiSelected = multiSelectSlots.includes(slotId);
                      const isPast = isSlotInPast(slotId);
                      const isBlockedSat = isBlockedSaturdaySlot(day, time);
                      const isBlockedHoliday = isDayHoliday(day);
                      const isBlocked = isBlockedSat || isBlockedHoliday;
                      
                      return (
                        <TableCell
                          key={slotId}
                          className={cn(
                            'h-14 text-center border text-xs p-1',
                            isBlocked ? 'bg-gray-200 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 transition-colors',
                            isToday(day) && !isBlocked && 'bg-primary/10',
                            isMultiSelected && 'bg-blue-200',
                            (isPast && reservation?.obs !== 'No asistió' && !isBlocked) && 'bg-red-100',
                             (isBlockedSat) && 'bg-red-100',
                            reservation?.obs === 'No asistió' && 'bg-black text-white'
                          )}
                          onClick={() => handleCellClick(slotId, isBlocked)}
                        >
                          {isBlockedHoliday ? (
                            <span className="font-bold">Feriado</span>
                          ) : reservation ? (
                            <div className="flex flex-col items-center justify-between h-full">
                              <div className="flex flex-col items-center justify-center">
                                <span className="font-bold">{reservation.name}</span>
                                <span>{reservation.obs}</span>
                              </div>
                              {!isPast && !isBlocked && (
                                <div className="flex flex-row items-center justify-center gap-2 mt-1">
                                  <button onClick={(e) => { e.stopPropagation(); handleEditReservation(slotId); }} className="p-1 bg-blue-200 hover:bg-blue-300 rounded mr-2">
                                      <Pencil className="h-3 w-3" />
                                  </button>
                                  <button onClick={(e) => handleDeleteReservation(e, slotId)} className="p-1 bg-red-200 hover:bg-red-300 rounded ml-2">
                                      <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            '\u00A0'
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={!!selectedSlot} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Reservación' : 'Nueva Reservación'}</DialogTitle>
            <div className="flex items-center gap-2">
              <DialogDescription className="capitalize">
                {getFormattedSlotDate(selectedSlot)}
              </DialogDescription>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={handleStartMultiSelect} disabled={isEditing || !patientName}>
                <Plus className="h-4 w-4" />
                <span className="sr-only">Añadir Múltiples</span>
              </Button>
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                className="col-span-3"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="obs" className="text-right">
                Obs
              </Label>
              <Textarea
                id="obs"
                className="col-span-3"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!patientName}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteConfirmationSlotId} onOpenChange={(open) => !open && setDeleteConfirmationSlotId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDesc>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la reservación.
            </AlertDialogDesc>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmationSlotId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!confirmationSlot} onOpenChange={(open) => !open && setConfirmationSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmación</DialogTitle>
            <DialogDescription className="flex flex-col gap-2 pt-2">
              <span className='capitalize'>{getFormattedSlotDate(confirmationSlot)}</span>
              <span className='font-bold text-lg'>{reservations[confirmationSlot!]?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => handleAttendance('Llamó')}>Llamó</Button>
            <Button variant="secondary" onClick={() => handleAttendance('No asistió')}>No asistió</Button>
            <Button onClick={() => handleAttendance('Asistió')}>Asistió</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!holidayConfirmationDate} onOpenChange={(open) => !open && setHolidayConfirmationDate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Día Festivo</AlertDialogTitle>
            <AlertDialogDesc>
              {holidayConfirmationDate && isDayHoliday(holidayConfirmationDate)
                ? `¿Desea eliminar el día ${format(holidayConfirmationDate, 'dd/MM/yyyy')} de la lista de feriados?`
                : `¿Desea marcar el día ${holidayConfirmationDate && format(holidayConfirmationDate, 'dd/MM/yyyy')} como feriado? Se bloquearán todas las celdas de este día.`
              }
            </AlertDialogDesc>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHolidayConfirmationDate(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmHolidayToggle}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
