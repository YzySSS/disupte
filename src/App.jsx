import { useEffect, useRef, useState } from 'react';
import {
  CaretRight,
  Check,
  DotsThree,
  Minus,
  Plus,
  X,
} from '@phosphor-icons/react';
import {
  FRAUD_TYPES,
  ILLEGAL_TYPES,
  PRIMARY_REASONS,
} from '../shared/complaint-options.mjs';
import { exitCurrentPage } from './exit-page.mjs';

function BrowserHeader({ titled = false, onClose, onMenu }) {
  const displayDomain = window.location.hostname || 'localhost';

  return (
    <header className="browser-header">
      <button className="icon-button close-button" onClick={onClose} aria-label="关闭">
        <X size={25} weight="light" />
      </button>
      <div className="browser-title">
        {titled ? <><strong>投诉</strong><small>{displayDomain}</small></> : <strong className="domain-only">{displayDomain}</strong>}
      </div>
      <button className="icon-button menu-button" onClick={onMenu} aria-label="更多">
        <DotsThree size={27} weight="bold" />
      </button>
    </header>
  );
}

function ChoiceList({ eyebrow, options, onChoose, footer }) {
  return (
    <section className="choice-screen">
      <p className="eyebrow">{eyebrow}</p>
      <div className="choice-list">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => onChoose(option)}>
            <span>{option}</span>
            <CaretRight size={17} weight="regular" />
          </button>
        ))}
      </div>
      {footer}
    </section>
  );
}

function PrimaryScreen({ onChoose, onNotice }) {
  return (
    <ChoiceList
      eyebrow="请选择投诉该账号的原因："
      options={PRIMARY_REASONS}
      onChoose={onChoose}
      footer={<button className="notice-link" onClick={onNotice}>投诉须知</button>}
    />
  );
}

function IllegalTypeScreen({ onChoose, onNotice, onBlockInfo }) {
  return (
    <ChoiceList
      eyebrow="请选择哪一类违法内容："
      options={ILLEGAL_TYPES}
      onChoose={onChoose}
      footer={
        <div className="secondary-footer">
          <button onClick={onBlockInfo}>了解「拉黑」功能，有效避免骚扰</button>
          <button onClick={onNotice}>投诉须知</button>
        </div>
      }
    />
  );
}

function FraudTypeScreen({ onChoose, onNotice, onGuide }) {
  return (
    <ChoiceList
      eyebrow="请选择哪一类诈骗内容："
      options={FRAUD_TYPES}
      onChoose={onChoose}
      footer={
        <div className="secondary-footer">
          <button onClick={onGuide}>网络诈骗投诉指引</button>
          <button onClick={onNotice}>投诉须知</button>
        </div>
      }
    />
  );
}

function EvidenceTile({ onSelect }) {
  return (
    <button className="evidence-tile" onClick={onSelect} type="button" aria-label="添加图片证据">
      <Plus size={43} weight="thin" />
    </button>
  );
}

function ComplaintForm({ selection, onSuccess, onError }) {
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const uploadRef = useRef(null);
  const imagesRef = useRef([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => () => {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
  }, []);

  const canSubmit = /^1\d{10}$/.test(phone) && content.trim().length >= 5;

  const addImages = (event) => {
    const selectedFiles = Array.from(event.target.files || []).slice(0, 9 - images.length);
    const files = selectedFiles.filter((file) => file.size <= 10 * 1024 * 1024);
    if (files.length !== selectedFiles.length) onError('单张图片不能超过 10MB');
    setImages((current) => [
      ...current,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
    event.target.value = '';
  };

  const removeImage = (index) => {
    setImages((current) => current.filter((image, itemIndex) => {
      if (itemIndex === index) URL.revokeObjectURL(image.url);
      return itemIndex !== index;
    }));
  };

  const submit = async () => {
    if (submitting) return;
    if (!canSubmit) {
      onError('请填写正确的手机号和投诉内容');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('primaryReason', selection.primaryReason);
    formData.append('secondaryReason', selection.secondaryReason);
    formData.append('phone', phone);
    formData.append('content', content.trim());
    images.forEach((image) => formData.append('evidence', image.file));

    try {
      const response = await fetch('/api/complaints', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.message || '提交暂时失败，请稍后重试');
      }
      onSuccess(result.complaintId);
    } catch (error) {
      setSubmitting(false);
      onError(error.message || '网络连接失败，请稍后重试');
    }
  };

  return (
    <section className="form-screen">
      <div className="form-card">
        <label className="phone-row">
          <span>联系方式</span>
          <input
            aria-label="手机号"
            inputMode="numeric"
            maxLength={11}
            placeholder="手机号"
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
          />
        </label>

        <div className="evidence-heading">
          <strong>图片证据</strong>
          <span>{images.length}/9</span>
        </div>
        <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden onChange={addImages} />
        <div className="evidence-grid">
          {images.map((image, index) => (
            <div className="evidence-preview" key={image.url}>
              <img src={image.url} alt={`图片证据 ${index + 1}`} />
              <button type="button" aria-label="删除图片" onClick={() => removeImage(index)}>
                <X size={12} weight="bold" />
              </button>
            </div>
          ))}
          {images.length < 9 && <EvidenceTile onSelect={() => uploadRef.current?.click()} />}
        </div>

        <div className="content-box">
          <textarea
            aria-label="投诉内容"
            maxLength={200}
            placeholder="请填写投诉内容"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <span>{content.length}/200</span>
        </div>
      </div>

      <button
        className={`submit-button ${canSubmit ? 'ready' : ''}`}
        type="button"
        onClick={submit}
        aria-disabled={!canSubmit || submitting}
        disabled={!canSubmit || submitting}
      >
        {submitting ? '提交中…' : '提交'}
      </button>
    </section>
  );
}

function SuccessScreen({ onDone }) {
  return (
    <section className="success-screen">
      <div className="success-icon"><Check size={46} weight="regular" /></div>
      <h1>投诉已提交</h1>
      <p>我们会尽快审核，并通过团队消息，<br />通知你审核结果。感谢您的支持！</p>
      <button type="button" onClick={onDone}>完成</button>
    </section>
  );
}

function PhoneHomeIndicator() {
  return <Minus className="home-indicator" size={92} weight="bold" aria-hidden="true" />;
}

export function App() {
  const [page, setPage] = useState('primary');
  const [transitionId, setTransitionId] = useState(0);
  const [toast, setToast] = useState('');
  const [selection, setSelection] = useState({ primaryReason: '', secondaryReason: '' });

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(''), 1800);
  };

  const goTo = (nextPage) => {
    setPage(nextPage);
    setTransitionId((value) => value + 1);
  };

  const choosePrimary = (reason) => {
    setSelection({ primaryReason: reason, secondaryReason: '' });
    if (reason === PRIMARY_REASONS[0]) goTo('illegal-types');
    else if (reason === PRIMARY_REASONS[1]) goTo('fraud-types');
    else goTo('form');
  };

  const chooseSecondary = (reason) => {
    setSelection((current) => ({ ...current, secondaryReason: reason }));
    goTo('form');
  };

  const exitPage = () => exitCurrentPage();

  const titled = page !== 'primary';

  return (
    <main className="mobile-prototype">
      <BrowserHeader titled={titled} onClose={exitPage} onMenu={() => showToast('更多操作')} />
      <div className="page-stage" key={`${page}-${transitionId}`}>
        {page === 'primary' && <PrimaryScreen onChoose={choosePrimary} onNotice={() => showToast('请如实填写投诉内容，请勿恶意投诉')} />}
        {page === 'illegal-types' && (
          <IllegalTypeScreen
            onChoose={chooseSecondary}
            onNotice={() => showToast('请如实填写投诉内容，请勿恶意投诉')}
            onBlockInfo={() => showToast('拉黑后将减少对方内容和互动触达')}
          />
        )}
        {page === 'fraud-types' && (
          <FraudTypeScreen
            onChoose={chooseSecondary}
            onNotice={() => showToast('请如实填写投诉内容，请勿恶意投诉')}
            onGuide={() => showToast('遇到网络诈骗请及时保留证据并报警')}
          />
        )}
        {page === 'form' && <ComplaintForm selection={selection} onSuccess={() => goTo('success')} onError={showToast} />}
        {page === 'success' && <SuccessScreen onDone={exitPage} />}
      </div>
      <PhoneHomeIndicator />
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
