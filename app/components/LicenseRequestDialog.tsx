'use client';

import { useState } from 'react';

interface UserInfo {
  userId: string;
  userName: string;
  userOrg: string;
  userEmail: string;
}

interface RequestPayload {
  userId?: string;
  userName?: string;
  userOrg?: string;
  userEmail?: string;
  machineId: string;
  machineIds: string[];
  requestedAt: string;
  product: string;
  sig: string;
}

export function LicenseRequestDialog({ isOpen, onClose, onSave }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userInfo: UserInfo, request: RequestPayload) => Promise<void>;
}) {
  const [userInfo, setUserInfo] = useState<UserInfo>({
    userId: '',
    userName: '',
    userOrg: '',
    userEmail: '',
  });
  const [request, setRequest] = useState<RequestPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!request) return;

    setLoading(true);
    try {
      await onSave(userInfo, request);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !request) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-bold mb-4">라이선스 요청 정보</h2>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4 mb-6">
          {/* 사용자 ID (고정) */}
          <div>
            <label className="block text-sm font-medium mb-1">사용자 ID</label>
            <input
              type="text"
              value={userInfo.userId}
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">고정값 (변경 불가)</p>
          </div>

          {/* 이름 (수정 가능) */}
          <div>
            <label className="block text-sm font-medium mb-1">이름</label>
            <input
              type="text"
              value={userInfo.userName}
              onChange={(e) =>
                setUserInfo({ ...userInfo, userName: e.target.value })
              }
              placeholder="이름을 입력하세요"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 소속 (수정 가능) */}
          <div>
            <label className="block text-sm font-medium mb-1">소속</label>
            <input
              type="text"
              value={userInfo.userOrg}
              onChange={(e) =>
                setUserInfo({ ...userInfo, userOrg: e.target.value })
              }
              placeholder="소속을 입력하세요"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 이메일 (고정) */}
          <div>
            <label className="block text-sm font-medium mb-1">이메일</label>
            <input
              type="email"
              value={userInfo.userEmail}
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">고정값 (변경 불가)</p>
          </div>

          {/* MachineID 정보 (참고용) */}
          <div className="bg-blue-50 p-3 rounded text-sm">
            <p className="font-semibold text-blue-900 mb-2">기계 정보</p>
            <p className="text-blue-800 break-all">
              <span className="font-mono text-xs">{request.machineId}</span>
            </p>
            <p className="text-xs text-blue-700 mt-1">
              ({request.machineIds.length}개 NIC 감지됨)
            </p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
