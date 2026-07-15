"""
Multimodal Attention-based Fusion Architecture and Modality Wrappers.
Extracts embeddings from Text, Image, and Audio models and fuses them using
multi-head self-attention and gated weighted late fusion.
Handles missing modalities seamlessly by masking inactive inputs.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, List, Optional, Tuple, Union

class TextFeatureExtractor(nn.Module):
    def __init__(self, vocab_size: int = 30522, embed_dim: int = 256, hidden_dim: int = 512, num_classes: int = 3):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.conv1 = nn.Conv1d(embed_dim, hidden_dim // 2, kernel_size=3, padding=1)
        self.conv2 = nn.Conv1d(embed_dim, hidden_dim // 2, kernel_size=5, padding=2)
        self.pool = nn.AdaptiveMaxPool1d(1)
        self.fc_proj = nn.Linear(hidden_dim, 512)
        self.dropout = nn.Dropout(0.3)
        self.classifier = nn.Linear(512, num_classes)
        
    def forward(self, input_ids: torch.Tensor, attention_mask: Optional[torch.Tensor] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        embeds = self.embedding(input_ids)
        embeds = embeds.transpose(1, 2)
        
        c1 = F.relu(self.conv1(embeds))
        c2 = F.relu(self.conv2(embeds))
        combined = torch.cat([c1, c2], dim=1)
        
        pooled = self.pool(combined).squeeze(-1)
        feat_emb = F.relu(self.fc_proj(pooled))
        feat_emb_dropped = self.dropout(feat_emb)
        logits = self.classifier(feat_emb_dropped)
        
        return logits, feat_emb


class ImageFeatureExtractor(nn.Module):
    def __init__(self, num_classes: int = 3):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 32, kernel_size=3, stride=2, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, stride=2, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.conv3 = nn.Conv2d(64, 128, kernel_size=3, stride=2, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.conv4 = nn.Conv2d(128, 256, kernel_size=3, stride=2, padding=1)
        self.bn4 = nn.BatchNorm2d(256)
        
        self.pool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc_proj = nn.Linear(256, 512)
        self.dropout = nn.Dropout(0.3)
        self.classifier = nn.Linear(512, num_classes)
        
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        x = F.relu(self.bn1(self.conv1(x)))
        x = F.relu(self.bn2(self.conv2(x)))
        x = F.relu(self.bn3(self.conv3(x)))
        x = F.relu(self.bn4(self.conv4(x)))
        
        pooled = self.pool(x).view(x.size(0), -1)
        feat_emb = F.relu(self.fc_proj(pooled))
        feat_emb_dropped = self.dropout(feat_emb)
        logits = self.classifier(feat_emb_dropped)
        
        return logits, feat_emb


class AudioFeatureExtractor(nn.Module):
    def __init__(self, num_classes: int = 3):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.pool1 = nn.MaxPool2d(2, 2)
        
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.pool2 = nn.MaxPool2d(2, 2)
        
        self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.pool3 = nn.AdaptiveAvgPool2d((1, 1))
        
        self.fc_proj = nn.Linear(128, 512)
        self.dropout = nn.Dropout(0.3)
        self.classifier = nn.Linear(512, num_classes)
        
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        if x.dim() == 2:
            batch_size = x.size(0)
            if x.size(1) < 8192:
                x = F.pad(x, (0, 8192 - x.size(1)))
            else:
                x = x[:, :8192]
            x = x.view(batch_size, 1, 64, 128)
        elif x.dim() == 3:
            x = x.unsqueeze(1)
            
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.pool1(x)
        x = F.relu(self.bn2(self.conv2(x)))
        x = self.pool2(x)
        x = F.relu(self.bn3(self.conv3(x)))
        x = self.pool3(x).view(x.size(0), -1)
        
        feat_emb = F.relu(self.fc_proj(x))
        feat_emb_dropped = self.dropout(feat_emb)
        logits = self.classifier(feat_emb_dropped)
        
        return logits, feat_emb


class MultimodalAttentionFusion(nn.Module):
    def __init__(self, embed_dim: int = 512, hidden_dim: int = 256, num_heads: int = 4, num_classes: int = 3):
        super().__init__()
        self.embed_dim = embed_dim
        self.hidden_dim = hidden_dim
        
        self.text_proj = nn.Linear(embed_dim, hidden_dim)
        self.image_proj = nn.Linear(embed_dim, hidden_dim)
        self.audio_proj = nn.Linear(embed_dim, hidden_dim)
        
        self.attention = nn.MultiheadAttention(embed_dim=hidden_dim, num_heads=num_heads, batch_first=True)
        self.layer_norm = nn.LayerNorm(hidden_dim)
        
        self.gate = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1)
        )
        
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes)
        )
        
        self.modality_weights = nn.Parameter(torch.ones(3, dtype=torch.float32))
        
    def forward(
        self,
        text_emb: Optional[torch.Tensor] = None,
        image_emb: Optional[torch.Tensor] = None,
        audio_emb: Optional[torch.Tensor] = None,
        text_logits: Optional[torch.Tensor] = None,
        image_logits: Optional[torch.Tensor] = None,
        audio_logits: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, torch.Tensor, Dict[str, float]]:
        batch_size = None
        device = None
        for tensor in [text_emb, image_emb, audio_emb]:
            if tensor is not None:
                batch_size = tensor.size(0)
                device = tensor.device
                break
        if batch_size is None:
            raise ValueError("At least one modality must be provided.")
            
        tokens = []
        mask = []
        active_indices = []
        
        if text_emb is not None:
            tokens.append(F.relu(self.text_proj(text_emb)).unsqueeze(1))
            mask.append(torch.zeros((batch_size, 1), dtype=torch.bool, device=device))
            active_indices.append(0)
        else:
            tokens.append(torch.zeros((batch_size, 1, self.hidden_dim), dtype=torch.float32, device=device))
            mask.append(torch.ones((batch_size, 1), dtype=torch.bool, device=device))
            
        if image_emb is not None:
            tokens.append(F.relu(self.image_proj(image_emb)).unsqueeze(1))
            mask.append(torch.zeros((batch_size, 1), dtype=torch.bool, device=device))
            active_indices.append(1)
        else:
            tokens.append(torch.zeros((batch_size, 1, self.hidden_dim), dtype=torch.float32, device=device))
            mask.append(torch.ones((batch_size, 1), dtype=torch.bool, device=device))
            
        if audio_emb is not None:
            tokens.append(F.relu(self.audio_proj(audio_emb)).unsqueeze(1))
            mask.append(torch.zeros((batch_size, 1), dtype=torch.bool, device=device))
            active_indices.append(2)
        else:
            tokens.append(torch.zeros((batch_size, 1, self.hidden_dim), dtype=torch.float32, device=device))
            mask.append(torch.ones((batch_size, 1), dtype=torch.bool, device=device))
            
        tokens_tensor = torch.cat(tokens, dim=1)
        padding_mask = torch.cat(mask, dim=1)
        
        all_missing = padding_mask.all(dim=1)
        if all_missing.any():
            padding_mask[all_missing] = False
            
        attn_out, attn_weights = self.attention(
            query=tokens_tensor,
            key=tokens_tensor,
            value=tokens_tensor,
            key_padding_mask=padding_mask
        )
        
        norm_tokens = self.layer_norm(tokens_tensor + attn_out)
        
        gate_scores = self.gate(norm_tokens).squeeze(-1)
        gate_scores = gate_scores.masked_fill(padding_mask, -1e9)
        gate_weights = F.softmax(gate_scores, dim=1)
        
        fused_embedding = torch.sum(norm_tokens * gate_weights.unsqueeze(-1), dim=1)
        
        attn_logits = self.fc(fused_embedding)
        
        late_logits = torch.zeros_like(attn_logits)
        active_weight_sum = 0.0
        
        w = F.softmax(self.modality_weights, dim=0)
        if text_logits is not None:
            late_logits += text_logits * w[0]
            active_weight_sum += w[0]
        if image_logits is not None:
            late_logits += image_logits * w[1]
            active_weight_sum += w[1]
        if audio_logits is not None:
            late_logits += audio_logits * w[2]
            active_weight_sum += w[2]
            
        if isinstance(active_weight_sum, torch.Tensor) and (active_weight_sum > 0).any():
            late_logits = late_logits / (active_weight_sum + 1e-8)
            fused_logits = 0.6 * attn_logits + 0.4 * late_logits
        else:
            fused_logits = attn_logits
            
        avg_weights = gate_weights.mean(dim=0).tolist()
        modality_attention_dict = {
            "text": float(avg_weights[0]) if 0 in active_indices else 0.0,
            "image": float(avg_weights[1]) if 1 in active_indices else 0.0,
            "audio": float(avg_weights[2]) if 2 in active_indices else 0.0
        }
        
        return fused_logits, fused_embedding, modality_attention_dict
