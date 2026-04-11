'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class ActivityLog extends Model {
    /**
     * Helper untuk membuat log entry dengan format standar.
     * @param {string} actorId - user.id yang melakukan aksi
     * @param {string} action - format 'resource.verb', misal 'leave.approve'
     * @param {string|null} targetType - nama tabel target, misal 'leave_request'
     * @param {string|null} targetId - UUID target
     * @param {object|null} payload - { before, after } atau detail lain
     * @param {string|null} ipAddress
     */
    static async record(actorId, action, targetType = null, targetId = null, payload = null, ipAddress = null) {
      return ActivityLog.create({
        actor_id: actorId,
        action,
        target_type: targetType,
        target_id: targetId,
        payload,
        ip_address: ipAddress,
      });
    }
  }

  ActivityLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    actor_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    target_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    target_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'ActivityLog',
    tableName: 'activity_logs',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    scopes: {
      byActor: (actorId) => ({ where: { actor_id: actorId } }),
      byAction: (action) => ({ where: { action } }),
      byTarget: (type, id) => ({ where: { target_type: type, target_id: id } }),
    },
  });

  return ActivityLog;
};
