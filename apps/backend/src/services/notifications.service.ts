import { EventEmitter } from 'events';

class NotificationsService {
  private emitter = new EventEmitter();

  emitPayslipChange(payload: any) {
    this.emitter.emit('payslip_changed', payload);
  }

  onPayslipChange(fn: (payload: any) => void) {
    this.emitter.on('payslip_changed', fn);
    return () => this.emitter.removeListener('payslip_changed', fn);
  }
}

export default new NotificationsService();
