'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class WorkSchedule extends Model {
    /**
     * Hitung menit keterlambatan dari waktu check-in aktual.
     * @param {Date} actualCheckIn - Waktu check-in aktual
     * @param {string} date - Tanggal string 'YYYY-MM-DD' untuk build datetime
     * @returns {number} menit telat (0 jika tidak telat)
     */
    calcLateMinutes(actualCheckIn, date) {
      const [hours, minutes] = this.check_in_time.split(':').map(Number);
      const scheduled = new Date(`${date}T${this.check_in_time}`);
      const deadline = new Date(scheduled.getTime() + this.tolerance_minutes * 60000);
      if (actualCheckIn <= deadline) return 0;
      return Math.floor((actualCheckIn - deadline) / 60000);
    }

    /**
     * Hitung total penalti rupiah dari menit keterlambatan.
     * @param {number} lateMinutes
     * @returns {number}
     */
    calcPenalty(lateMinutes) {
      return lateMinutes * parseFloat(this.penalty_per_minute);
    }
  }

  WorkSchedule.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
    },
    check_in_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    check_out_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    tolerance_minutes: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    penalty_per_minute: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
  }, {
    sequelize,
    modelName: 'WorkSchedule',
    tableName: 'work_schedules',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return WorkSchedule;
};
